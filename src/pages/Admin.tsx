import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Users, FileCheck, MessageSquare, Bug, Shield, ChevronRight, Check, X, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

interface KYCRequest {
  id: string;
  user_id: string;
  kyc_type: string;
  document_number: string;
  document_url: string;
  status: string;
  admin_notes: string | null;
  created_at: string;
  profile?: {
    full_name: string | null;
    avatar_url: string | null;
  };
}

interface Feedback {
  id: string;
  user_id: string;
  type: string;
  category: string;
  severity: string | null;
  title: string;
  description: string;
  status: string;
  admin_notes: string | null;
  created_at: string;
  profile?: {
    full_name: string | null;
    avatar_url: string | null;
  };
  images?: string[];
}

interface UserProfile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  kyc_status: string | null;
  created_at: string;
}

const Admin = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [kycRequests, setKycRequests] = useState<KYCRequest[]>([]);
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedKyc, setSelectedKyc] = useState<KYCRequest | null>(null);
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    checkAdminAccess();
  }, [user]);

  const checkAdminAccess = async () => {
    if (!user) {
      navigate("/auth");
      return;
    }

    // Check if user has admin role
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roles) {
      toast({ title: "Access Denied", description: "You don't have admin privileges", variant: "destructive" });
      navigate("/home");
      return;
    }

    setIsAdmin(true);
    fetchData();
  };

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([fetchKYCRequests(), fetchFeedback(), fetchUsers()]);
    setLoading(false);
  };

  const fetchKYCRequests = async () => {
    const { data } = await supabase
      .from("kyc_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (data) {
      const userIds = [...new Set(data.map(k => k.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", userIds);

      const profilesMap: Record<string, any> = {};
      profiles?.forEach(p => profilesMap[p.id] = p);

      setKycRequests(data.map(k => ({ ...k, profile: profilesMap[k.user_id] })));
    }
  };

  const fetchFeedback = async () => {
    const { data } = await supabase
      .from("feedback")
      .select("*")
      .order("created_at", { ascending: false });

    if (data) {
      const userIds = [...new Set(data.map(f => f.user_id))];
      const feedbackIds = data.map(f => f.id);

      const [profilesRes, imagesRes] = await Promise.all([
        supabase.from("profiles").select("id, full_name, avatar_url").in("id", userIds),
        supabase.from("feedback_images").select("feedback_id, image_url").in("feedback_id", feedbackIds)
      ]);

      const profilesMap: Record<string, any> = {};
      profilesRes.data?.forEach(p => profilesMap[p.id] = p);

      const imagesMap: Record<string, string[]> = {};
      imagesRes.data?.forEach(i => {
        if (!imagesMap[i.feedback_id]) imagesMap[i.feedback_id] = [];
        imagesMap[i.feedback_id].push(i.image_url);
      });

      setFeedbacks(data.map(f => ({ 
        ...f, 
        profile: profilesMap[f.user_id],
        images: imagesMap[f.id] || []
      })));
    }
  };

  const fetchUsers = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url, kyc_status, created_at")
      .order("created_at", { ascending: false })
      .limit(100);

    if (data) setUsers(data);
  };

  const handleKYCAction = async (action: "verified" | "rejected") => {
    if (!selectedKyc) return;
    setProcessing(true);

    try {
      const { error } = await supabase
        .from("kyc_requests")
        .update({ 
          status: action, 
          admin_notes: adminNotes,
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString()
        })
        .eq("id", selectedKyc.id);

      if (error) throw error;

      toast({ 
        title: `KYC ${action === "verified" ? "Approved" : "Rejected"}`,
        description: `User's KYC has been ${action}`
      });

      setSelectedKyc(null);
      setAdminNotes("");
      fetchKYCRequests();
      fetchUsers();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  const handleFeedbackAction = async (status: string) => {
    if (!selectedFeedback) return;
    setProcessing(true);

    try {
      const { error } = await supabase
        .from("feedback")
        .update({ status, admin_notes: adminNotes })
        .eq("id", selectedFeedback.id);

      if (error) throw error;

      toast({ title: "Feedback Updated", description: `Status changed to ${status}` });
      setSelectedFeedback(null);
      setAdminNotes("");
      fetchFeedback();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending": return "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400";
      case "verified": case "resolved": return "bg-green-500/20 text-green-700 dark:text-green-400";
      case "rejected": return "bg-red-500/20 text-red-700 dark:text-red-400";
      case "in_progress": return "bg-blue-500/20 text-blue-700 dark:text-blue-400";
      case "reviewed": return "bg-purple-500/20 text-purple-700 dark:text-purple-400";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const getSeverityColor = (severity: string | null) => {
    switch (severity) {
      case "low": return "bg-green-500/20 text-green-700";
      case "medium": return "bg-yellow-500/20 text-yellow-700";
      case "high": return "bg-orange-500/20 text-orange-700";
      case "critical": return "bg-red-500/20 text-red-700";
      default: return "bg-muted text-muted-foreground";
    }
  };

  if (loading || !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-3 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const pendingKyc = kycRequests.filter(k => k.status === "pending").length;
  const pendingFeedback = feedbacks.filter(f => f.status === "pending").length;
  const totalUsers = users.length;

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-gradient-to-r from-primary to-accent p-4 shadow-lg safe-top">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="text-primary-foreground">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary-foreground" />
            <h1 className="text-xl font-bold text-primary-foreground">Admin Dashboard</h1>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="text-center">
            <CardContent className="pt-4 pb-3">
              <Users className="h-6 w-6 mx-auto text-primary mb-1" />
              <p className="text-2xl font-bold">{totalUsers}</p>
              <p className="text-xs text-muted-foreground">Users</p>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="pt-4 pb-3">
              <FileCheck className="h-6 w-6 mx-auto text-orange-500 mb-1" />
              <p className="text-2xl font-bold">{pendingKyc}</p>
              <p className="text-xs text-muted-foreground">Pending KYC</p>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="pt-4 pb-3">
              <MessageSquare className="h-6 w-6 mx-auto text-blue-500 mb-1" />
              <p className="text-2xl font-bold">{pendingFeedback}</p>
              <p className="text-xs text-muted-foreground">Feedback</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="kyc" className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="kyc" className="flex-1">KYC Requests</TabsTrigger>
            <TabsTrigger value="feedback" className="flex-1">Feedback</TabsTrigger>
            <TabsTrigger value="users" className="flex-1">Users</TabsTrigger>
          </TabsList>

          {/* KYC Tab */}
          <TabsContent value="kyc" className="mt-4 space-y-3">
            {kycRequests.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No KYC requests</p>
            ) : (
              kycRequests.map((kyc) => (
                <Card key={kyc.id} className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => { setSelectedKyc(kyc); setAdminNotes(kyc.admin_notes || ""); }}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={kyc.profile?.avatar_url || ""} />
                          <AvatarFallback>{kyc.profile?.full_name?.charAt(0) || "U"}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{kyc.profile?.full_name || "Unknown"}</p>
                          <p className="text-xs text-muted-foreground">{kyc.kyc_type} • {kyc.document_number}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={getStatusColor(kyc.status)}>{kyc.status}</Badge>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* Feedback Tab */}
          <TabsContent value="feedback" className="mt-4 space-y-3">
            {feedbacks.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No feedback</p>
            ) : (
              feedbacks.map((fb) => (
                <Card key={fb.id} className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => { setSelectedFeedback(fb); setAdminNotes(fb.admin_notes || ""); }}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{fb.type === "bug" ? <Bug className="h-3 w-3 mr-1" /> : null}{fb.type}</Badge>
                        <Badge variant="secondary">{fb.category}</Badge>
                        {fb.severity && <Badge className={getSeverityColor(fb.severity)}>{fb.severity}</Badge>}
                      </div>
                      <Badge className={getStatusColor(fb.status)}>{fb.status}</Badge>
                    </div>
                    <p className="font-medium">{fb.title}</p>
                    <p className="text-sm text-muted-foreground line-clamp-2">{fb.description}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Avatar className="h-5 w-5">
                        <AvatarImage src={fb.profile?.avatar_url || ""} />
                        <AvatarFallback className="text-[10px]">{fb.profile?.full_name?.charAt(0) || "U"}</AvatarFallback>
                      </Avatar>
                      <span className="text-xs text-muted-foreground">{fb.profile?.full_name || "Unknown"}</span>
                      {fb.images && fb.images.length > 0 && (
                        <span className="text-xs text-muted-foreground">• {fb.images.length} image(s)</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users" className="mt-4 space-y-3">
            {users.map((u) => (
              <Card key={u.id} className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => navigate(`/profile/${u.id}`)}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={u.avatar_url || ""} />
                        <AvatarFallback>{u.full_name?.charAt(0) || "U"}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{u.full_name || "Unknown"}</p>
                        <p className="text-xs text-muted-foreground">Joined {new Date(u.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <Badge className={getStatusColor(u.kyc_status || "not_submitted")}>{u.kyc_status || "not_submitted"}</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </div>

      {/* KYC Review Dialog */}
      <Dialog open={!!selectedKyc} onOpenChange={() => setSelectedKyc(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Review KYC Request</DialogTitle>
          </DialogHeader>
          {selectedKyc && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={selectedKyc.profile?.avatar_url || ""} />
                  <AvatarFallback>{selectedKyc.profile?.full_name?.charAt(0) || "U"}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{selectedKyc.profile?.full_name || "Unknown"}</p>
                  <p className="text-sm text-muted-foreground">{selectedKyc.kyc_type}</p>
                </div>
              </div>
              
              <div className="space-y-2">
                <p className="text-sm font-medium">Document Number</p>
                <p className="text-sm bg-muted p-2 rounded">{selectedKyc.document_number}</p>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Document</p>
                <a href={selectedKyc.document_url} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" className="gap-2 w-full">
                    <Eye className="h-4 w-4" /> View Document
                  </Button>
                </a>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Admin Notes</p>
                <Textarea
                  placeholder="Add notes (optional, visible to user if rejected)..."
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="destructive" onClick={() => handleKYCAction("rejected")} disabled={processing} className="flex-1 gap-2">
              <X className="h-4 w-4" /> Reject
            </Button>
            <Button onClick={() => handleKYCAction("verified")} disabled={processing} className="flex-1 gap-2">
              <Check className="h-4 w-4" /> Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Feedback Review Dialog */}
      <Dialog open={!!selectedFeedback} onOpenChange={() => setSelectedFeedback(null)}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Review Feedback</DialogTitle>
          </DialogHeader>
          {selectedFeedback && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline">{selectedFeedback.type}</Badge>
                <Badge variant="secondary">{selectedFeedback.category}</Badge>
                {selectedFeedback.severity && (
                  <Badge className={getSeverityColor(selectedFeedback.severity)}>{selectedFeedback.severity}</Badge>
                )}
              </div>

              <div>
                <p className="font-medium text-lg">{selectedFeedback.title}</p>
                <p className="text-sm text-muted-foreground mt-1">{selectedFeedback.description}</p>
              </div>

              {selectedFeedback.images && selectedFeedback.images.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Attachments</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedFeedback.images.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                        <img src={url} alt="" className="w-20 h-20 object-cover rounded-lg" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <p className="text-sm font-medium">Admin Notes</p>
                <Textarea
                  placeholder="Add notes..."
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Update Status</p>
                <div className="flex flex-wrap gap-2">
                  {["reviewed", "in_progress", "resolved", "rejected"].map((status) => (
                    <Button
                      key={status}
                      size="sm"
                      variant={selectedFeedback.status === status ? "default" : "outline"}
                      onClick={() => handleFeedbackAction(status)}
                      disabled={processing}
                    >
                      {status.replace("_", " ")}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Admin;