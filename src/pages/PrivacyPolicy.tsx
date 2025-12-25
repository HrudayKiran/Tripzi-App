import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

const PrivacyPolicy = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="flex items-center gap-4 p-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-semibold">Privacy Policy</h1>
        </div>
      </div>

      <div className="p-6 space-y-6">
        <section>
          <h2 className="text-lg font-semibold mb-3">1. Information We Collect</h2>
          <p className="text-muted-foreground leading-relaxed">
            We collect information you provide directly to us, such as when you create an account, 
            create or join a trip, send messages, or contact us for support. This includes your name, 
            email address, phone number, profile picture, and any other information you choose to provide.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">2. How We Use Your Information</h2>
          <p className="text-muted-foreground leading-relaxed">
            We use the information we collect to provide, maintain, and improve our services, 
            process transactions, send notifications about trips and messages, and respond to 
            your comments and questions.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">3. Information Sharing</h2>
          <p className="text-muted-foreground leading-relaxed">
            We do not share your personal information with third parties except as described in 
            this policy. We may share information with trip organizers when you join a trip, 
            and with service providers who assist us in operating our platform.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">4. Data Security</h2>
          <p className="text-muted-foreground leading-relaxed">
            We implement appropriate security measures to protect your personal information 
            against unauthorized access, alteration, disclosure, or destruction. However, 
            no method of transmission over the Internet is 100% secure.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">5. Your Rights</h2>
          <p className="text-muted-foreground leading-relaxed">
            You have the right to access, update, or delete your personal information at any time. 
            You can do this through your account settings or by contacting us directly.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">6. Contact Us</h2>
          <p className="text-muted-foreground leading-relaxed">
            If you have any questions about this Privacy Policy, please contact us at 
            support@tripzi.com
          </p>
        </section>

        <p className="text-sm text-muted-foreground pt-4 border-t">
          Last updated: December 2024
        </p>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
