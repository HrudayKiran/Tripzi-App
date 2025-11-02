import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check, X, FileText, Eye, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface KYCRequest {
  id: string;
  user_id: string;
  kyc_type: string;
  document_number: string;
  document_url: string;
  status: string;
  admin_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  profiles: {
    full_name: string | null;
    avatar_url: string | null;
  } | null;
}

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [kycRequests, setKycRequests] = useState<KYCRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<KYCRequest | null>(null);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [reviewAction, setReviewAction] = useState<"approve" | "reject" | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!profile) return; // Wait for profile to load
    if (profile.role !== "admin") {
      navigate("/");
      return;
    }
    if (user) {
      fetchKYCRequests();
    }
  }, [profile, user, navigate]);

  const fetchKYCRequests = useCallback(async () => {
    try {
      // First verify admin role
      if (!profile || profile.role !== "admin") {
        console.error("Not an admin user");
        return;
      }

      // Fetch KYC requests
      const { data: kycData, error: kycError } = await supabase
        .from("kyc_requests")
        .select("*")
        .order("created_at", { ascending: false });

      if (kycError) {
        console.error("Error fetching KYC requests:", kycError);
        throw kycError;
      }

      if (!kycData || kycData.length === 0) {
        setKycRequests([]);
        return;
      }

      // Fetch profiles separately to avoid RLS join issues
      const userIds = [...new Set(kycData.map(r => r.user_id))];
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", userIds);

      // Combine KYC requests with profile data
      const combinedData = kycData.map(request => ({
        ...request,
        profiles: profilesData?.find(p => p.id === request.user_id) || null,
      }));

      setKycRequests(combinedData as KYCRequest[]);
    } catch (error: any) {
      console.error("Error fetching KYC requests:", error);
      const errorMessage = error?.message || error?.details || "Unknown error";
      toast({
        title: "Error",
        description: `Failed to load KYC requests: ${errorMessage}`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [profile]);

  // Subscribe to real-time updates for new KYC requests
  useEffect(() => {
    if (profile?.role !== "admin") return;

    const channel = supabase
      .channel('kyc_requests_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'kyc_requests'
        },
        () => {
          // Refresh the list when any change occurs
          fetchKYCRequests();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile, fetchKYCRequests]);

  const handleReview = (request: KYCRequest, action: "approve" | "reject") => {
    setSelectedRequest(request);
    setReviewAction(action);
    setAdminNotes("");
    setReviewDialogOpen(true);
  };

  const submitReview = async () => {
    if (!user || !selectedRequest || !reviewAction) return;

    setProcessing(true);
    try {
      const { error } = await supabase
        .from("kyc_requests")
        .update({
          status: reviewAction === "approve" ? "verified" : "rejected",
          admin_notes: adminNotes.trim() || null,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", selectedRequest.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: `KYC request ${reviewAction === "approve" ? "approved" : "rejected"} successfully`,
      });

      setReviewDialogOpen(false);
      setSelectedRequest(null);
      setReviewAction(null);
      setAdminNotes("");
      fetchKYCRequests();
    } catch (error: any) {
      console.error("Error reviewing KYC:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to review KYC request",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "verified":
        return <Badge className="bg-green-100 text-green-800">Verified</Badge>;
      case "pending":
        return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>;
      case "rejected":
        return <Badge className="bg-red-100 text-red-800">Rejected</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const pendingRequests = kycRequests.filter(r => r.status === "pending");
  const verifiedRequests = kycRequests.filter(r => r.status === "verified");
  const rejectedRequests = kycRequests.filter(r => r.status === "rejected");

  return (
    <div className="min-h-screen pb-24 bg-muted/30">
      <div className="sticky top-0 z-10 bg-gradient-to-r from-primary to-accent p-4 shadow-lg">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="text-primary-foreground">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold text-primary-foreground">Admin Dashboard</h1>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-yellow-600">{pendingRequests.length}</p>
                <p className="text-sm text-muted-foreground">Pending</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{verifiedRequests.length}</p>
                <p className="text-sm text-muted-foreground">Verified</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-red-600">{rejectedRequests.length}</p>
                <p className="text-sm text-muted-foreground">Rejected</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* KYC Requests */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>KYC Requests</CardTitle>
                <CardDescription>Review and manage user verification requests</CardDescription>
              </div>
              <Button variant="outline" size="icon" onClick={fetchKYCRequests}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : (
              <Tabs defaultValue="pending">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="pending">
                    Pending ({pendingRequests.length})
                  </TabsTrigger>
                  <TabsTrigger value="verified">
                    Verified ({verifiedRequests.length})
                  </TabsTrigger>
                  <TabsTrigger value="rejected">
                    Rejected ({rejectedRequests.length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="pending" className="space-y-4 mt-4">
                  {pendingRequests.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">No pending requests</div>
                  ) : (
                    pendingRequests.map((request) => (
                      <Card key={request.id}>
                        <CardContent className="pt-6">
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-4 flex-1">
                              <Avatar>
                                <AvatarImage src={request.profiles?.avatar_url || ""} />
                                <AvatarFallback>
                                  {request.profiles?.full_name?.charAt(0) || "U"}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 space-y-2">
                                <div>
                                  <p className="font-semibold">{request.profiles?.full_name || "Anonymous"}</p>
                                  <p className="text-sm text-muted-foreground">
                                    {request.kyc_type === "aadhaar" ? "Aadhaar" : "PAN"}: {request.document_number}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    Submitted: {new Date(request.created_at).toLocaleString()}
                                  </p>
                                </div>
                                <div className="flex gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => window.open(request.document_url, "_blank")}
                                  >
                                    <Eye className="h-4 w-4 mr-2" />
                                    View Document
                                  </Button>
                                </div>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleReview(request, "approve")}
                                className="bg-green-600 hover:bg-green-700"
                              >
                                <Check className="h-4 w-4 mr-2" />
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleReview(request, "reject")}
                              >
                                <X className="h-4 w-4 mr-2" />
                                Reject
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </TabsContent>

                <TabsContent value="verified" className="space-y-4 mt-4">
                  {verifiedRequests.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">No verified requests</div>
                  ) : (
                    verifiedRequests.map((request) => (
                      <Card key={request.id}>
                        <CardContent className="pt-6">
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-4 flex-1">
                              <Avatar>
                                <AvatarImage src={request.profiles?.avatar_url || ""} />
                                <AvatarFallback>
                                  {request.profiles?.full_name?.charAt(0) || "U"}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 space-y-2">
                                <div className="flex items-center gap-2">
                                  <p className="font-semibold">{request.profiles?.full_name || "Anonymous"}</p>
                                  {getStatusBadge(request.status)}
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  {request.kyc_type === "aadhaar" ? "Aadhaar" : "PAN"}: {request.document_number}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Reviewed: {request.reviewed_at ? new Date(request.reviewed_at).toLocaleString() : "N/A"}
                                </p>
                              </div>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => window.open(request.document_url, "_blank")}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              View Document
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </TabsContent>

                <TabsContent value="rejected" className="space-y-4 mt-4">
                  {rejectedRequests.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">No rejected requests</div>
                  ) : (
                    rejectedRequests.map((request) => (
                      <Card key={request.id}>
                        <CardContent className="pt-6">
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-4 flex-1">
                              <Avatar>
                                <AvatarImage src={request.profiles?.avatar_url || ""} />
                                <AvatarFallback>
                                  {request.profiles?.full_name?.charAt(0) || "U"}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 space-y-2">
                                <div className="flex items-center gap-2">
                                  <p className="font-semibold">{request.profiles?.full_name || "Anonymous"}</p>
                                  {getStatusBadge(request.status)}
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  {request.kyc_type === "aadhaar" ? "Aadhaar" : "PAN"}: {request.document_number}
                                </p>
                                {request.admin_notes && (
                                  <p className="text-sm text-red-600">
                                    <strong>Notes:</strong> {request.admin_notes}
                                  </p>
                                )}
                                <p className="text-xs text-muted-foreground">
                                  Reviewed: {request.reviewed_at ? new Date(request.reviewed_at).toLocaleString() : "N/A"}
                                </p>
                              </div>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => window.open(request.document_url, "_blank")}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              View Document
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Review Dialog */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reviewAction === "approve" ? "Approve" : "Reject"} KYC Request
            </DialogTitle>
            <DialogDescription>
              {reviewAction === "approve" 
                ? "Confirm approval of this KYC request. The user will be notified." 
                : "Provide a reason for rejection. The user will be notified."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectedRequest && (
              <div className="space-y-2">
                <p className="text-sm">
                  <strong>User:</strong> {selectedRequest.profiles?.full_name || "Anonymous"}
                </p>
                <p className="text-sm">
                  <strong>Document Type:</strong> {selectedRequest.kyc_type === "aadhaar" ? "Aadhaar" : "PAN"}
                </p>
                <p className="text-sm">
                  <strong>Document Number:</strong> {selectedRequest.document_number}
                </p>
              </div>
            )}
            {reviewAction === "reject" && (
              <div className="space-y-2">
                <Label htmlFor="notes">Rejection Reason (Optional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Provide feedback for the user..."
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  rows={3}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={submitReview}
              disabled={processing}
              className={reviewAction === "approve" ? "bg-green-600 hover:bg-green-700" : ""}
            >
              {processing ? "Processing..." : reviewAction === "approve" ? "Approve" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDashboard;

