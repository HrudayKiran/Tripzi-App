import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Upload, FileText, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Validation functions
const validateAadhaar = (aadhaar: string): boolean => {
  // Aadhaar must be exactly 12 digits
  // Must not be all same digits (e.g., 111111111111)
  // Must not start with 0 or 1 (as per UIDAI rules)
  if (aadhaar.length !== 12) return false;
  if (!/^\d{12}$/.test(aadhaar)) return false;
  if (aadhaar.startsWith('0') || aadhaar.startsWith('1')) return false;
  // Check if all digits are same
  if (/^(\d)\1{11}$/.test(aadhaar)) return false;
  return true;
};

const validatePAN = (pan: string): boolean => {
  // PAN format: ABCDE1234F (5 letters, 4 digits, 1 letter)
  const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
  return panRegex.test(pan);
};

const KYCRequest = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [kycType, setKycType] = useState<"aadhaar" | "pan" | "">("");
  const [documentNumber, setDocumentNumber] = useState("");
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [currentKYCStatus, setCurrentKYCStatus] = useState<string | null>(null);
  const [documentNumberError, setDocumentNumberError] = useState<string>("");

  useEffect(() => {
    if (profile?.kyc_status) {
      setCurrentKYCStatus(profile.kyc_status);
    }
  }, [profile]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      // Validate file type
      if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
        toast({
          title: "Invalid file type",
          description: "Please upload an image (JPG, PNG) or PDF file",
          variant: "destructive",
        });
        return;
      }
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Please upload a file smaller than 5MB",
          variant: "destructive",
        });
        return;
      }
      setDocumentFile(file);
    }
  };

  const uploadDocument = async (): Promise<string | null> => {
    if (!user || !documentFile || !kycType) return null;

    setUploading(true);
    try {
      const fileExt = documentFile.name.split(".").pop();
      const fileName = `${user.id}/${kycType}-${Date.now()}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from("kyc-documents")
        .upload(fileName, documentFile, {
          cacheControl: "3600",
          upsert: false,
        });

      if (error) {
        // Check if bucket doesn't exist
        if (error.message?.includes("bucket") || error.message?.includes("not found")) {
          throw new Error("Storage bucket 'kyc-documents' not found. Please create it in Supabase Dashboard > Storage > Create Bucket (name: kyc-documents, public: no). See QUICK_FIX_KYC_BUCKET.sql for SQL solution.");
        }
        throw error;
      }

      // Get the file URL (for private buckets, we need to use signed URL or getPublicUrl)
      const { data: { publicUrl } } = supabase.storage
        .from("kyc-documents")
        .getPublicUrl(fileName);

      return publicUrl;
    } catch (error: any) {
      console.error("Error uploading document:", error);
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload document. Please check if the storage bucket exists.",
        variant: "destructive",
      });
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !kycType || !documentNumber || !documentFile) {
      toast({
        title: "Missing information",
        description: "Please fill in all fields and upload a document",
        variant: "destructive",
      });
      return;
    }

    // Validate document number before submission
    if (kycType === "aadhaar") {
      if (!validateAadhaar(documentNumber)) {
        setDocumentNumberError("Invalid Aadhaar number. Please check and try again.");
        toast({
          title: "Invalid Aadhaar",
          description: "Aadhaar must be 12 digits, not start with 0/1, and not all same digits.",
          variant: "destructive",
        });
        return;
      }
    } else if (kycType === "pan") {
      if (!validatePAN(documentNumber)) {
        setDocumentNumberError("Invalid PAN format. Must be ABCDE1234F format.");
        toast({
          title: "Invalid PAN",
          description: "PAN must be in format: 5 letters, 4 digits, 1 letter (e.g., ABCDE1234F)",
          variant: "destructive",
        });
        return;
      }
    }

    setSubmitting(true);

    try {
      // Upload document first
      const documentUrl = await uploadDocument();
      if (!documentUrl) {
        setSubmitting(false);
        return;
      }

      // Create KYC request
      const { error } = await supabase.from("kyc_requests").insert({
        user_id: user.id,
        kyc_type: kycType,
        document_number: documentNumber,
        document_url: documentUrl,
        status: "pending",
      });

      if (error) throw error;

      // Update profile KYC status to pending
      await supabase
        .from("profiles")
        .update({ kyc_status: "pending" })
        .eq("id", user.id);

      toast({
        title: "Success!",
        description: "KYC request submitted successfully. We'll review it soon.",
      });

      navigate("/profile");
    } catch (error: any) {
      console.error("Error submitting KYC:", error);
      toast({
        title: "Submission failed",
        description: error.message || "Failed to submit KYC request",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const getKYCStatusBadge = (status: string | null) => {
    switch (status) {
      case "verified":
        return <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">Verified</span>;
      case "pending":
        return <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">Pending Review</span>;
      case "rejected":
        return <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium">Rejected</span>;
      default:
        return <span className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm font-medium">Not Submitted</span>;
    }
  };

  return (
    <div className="min-h-screen pb-24 bg-muted/30">
      <div className="sticky top-0 z-10 bg-gradient-to-r from-primary to-accent p-4 shadow-lg">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="text-primary-foreground">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold text-primary-foreground">KYC Verification</h1>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Current Status */}
        <Card>
          <CardHeader>
            <CardTitle>Current KYC Status</CardTitle>
            <CardDescription>Your verification status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-2">Verification Status</p>
                {getKYCStatusBadge(currentKYCStatus)}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KYC Request Form */}
        {currentKYCStatus !== "verified" && (
          <Card>
            <CardHeader>
              <CardTitle>Submit KYC Documents</CardTitle>
              <CardDescription>
                Complete your verification by submitting your Aadhaar or PAN card
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Document Type *</Label>
                  <Select 
                    value={kycType} 
                    onValueChange={(value) => {
                      setKycType(value as "aadhaar" | "pan");
                      // Reset document number when type changes
                      setDocumentNumber("");
                      setDocumentNumberError("");
                      setDocumentFile(null);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select document type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="aadhaar">
                        <div className="flex items-center gap-2">
                          <CreditCard className="h-4 w-4" />
                          <span>Aadhaar Card</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="pan">
                        <div className="flex items-center gap-2">
                          <CreditCard className="h-4 w-4" />
                          <span>PAN Card</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {kycType && (
                  <div className="space-y-2">
                    <Label>
                      {kycType === "aadhaar" ? "Aadhaar Number" : "PAN Number"} *
                    </Label>
                    <Input
                      placeholder={
                        kycType === "aadhaar" 
                          ? "Enter 12-digit Aadhaar number (e.g., 123456789012)" 
                          : "Enter PAN number (e.g., ABCDE1234F)"
                      }
                      value={documentNumber}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\s/g, "").replace(/-/g, "");
                        let error = "";
                        
                        if (kycType === "aadhaar") {
                          // Only allow digits, max 12
                          if (value.length <= 12 && /^\d*$/.test(value)) {
                            setDocumentNumber(value);
                            // Validate when complete
                            if (value.length === 12) {
                              if (!validateAadhaar(value)) {
                                error = "Invalid Aadhaar number. Must be 12 digits, not start with 0/1, and not all same digits.";
                              }
                            }
                          }
                        } else {
                          // PAN: Only allow alphanumeric, max 10, convert to uppercase
                          if (value.length <= 10 && /^[A-Z0-9]*$/i.test(value)) {
                            const upperValue = value.toUpperCase();
                            setDocumentNumber(upperValue);
                            // Validate when complete
                            if (upperValue.length === 10) {
                              if (!validatePAN(upperValue)) {
                                error = "Invalid PAN format. Must be in format: ABCDE1234F (5 letters, 4 digits, 1 letter)";
                              }
                            }
                          }
                        }
                        setDocumentNumberError(error);
                      }}
                      maxLength={kycType === "aadhaar" ? 12 : 10}
                      className={documentNumberError ? "border-red-500" : ""}
                      required
                    />
                    {documentNumberError && (
                      <p className="text-sm text-red-600">{documentNumberError}</p>
                    )}
                    {kycType === "aadhaar" && documentNumber.length > 0 && documentNumber.length < 12 && (
                      <p className="text-xs text-muted-foreground">
                        {12 - documentNumber.length} digits remaining
                      </p>
                    )}
                    {kycType === "pan" && documentNumber.length > 0 && documentNumber.length < 10 && (
                      <p className="text-xs text-muted-foreground">
                        Format: 5 letters, 4 digits, 1 letter (e.g., ABCDE1234F)
                      </p>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Upload Document *</Label>
                  <div className="border-2 border-dashed rounded-lg p-6 text-center">
                    <input
                      type="file"
                      id="document-upload"
                      accept="image/*,.pdf"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <label htmlFor="document-upload" className="cursor-pointer">
                      {documentFile ? (
                        <div className="space-y-2">
                          <FileText className="h-8 w-8 mx-auto text-primary" />
                          <p className="text-sm font-medium">{documentFile.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {(documentFile.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.preventDefault();
                              setDocumentFile(null);
                            }}
                          >
                            Remove
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">
                            Click to upload or drag and drop
                          </p>
                          <p className="text-xs text-muted-foreground">
                            PNG, JPG, PDF up to 5MB
                          </p>
                        </div>
                      )}
                    </label>
                  </div>
                </div>

                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-sm text-blue-900">
                    <strong>Note:</strong> Your documents will be securely stored and reviewed by our admin team. 
                    This process may take 24-48 hours.
                  </p>
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={
                    uploading || 
                    submitting || 
                    !kycType || 
                    !documentNumber || 
                    !documentFile ||
                    !!documentNumberError ||
                    (kycType === "aadhaar" && documentNumber.length !== 12) ||
                    (kycType === "pan" && documentNumber.length !== 10)
                  }
                >
                  {uploading ? "Uploading..." : submitting ? "Submitting..." : "Submit for Verification"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {currentKYCStatus === "verified" && (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center space-y-2">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                  <CreditCard className="h-8 w-8 text-green-600" />
                </div>
                <h3 className="text-lg font-semibold">KYC Verified</h3>
                <p className="text-sm text-muted-foreground">
                  Your identity has been successfully verified. You can now use all platform features.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default KYCRequest;

