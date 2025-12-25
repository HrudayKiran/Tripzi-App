import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

const Terms = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="flex items-center gap-4 p-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-semibold">Terms and Conditions</h1>
        </div>
      </div>

      <div className="p-6 space-y-6">
        <section>
          <h2 className="text-lg font-semibold mb-3">1. Acceptance of Terms</h2>
          <p className="text-muted-foreground leading-relaxed">
            By accessing and using Tripzi, you agree to be bound by these Terms and Conditions. 
            If you do not agree to these terms, please do not use our services.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">2. User Accounts</h2>
          <p className="text-muted-foreground leading-relaxed">
            You are responsible for maintaining the confidentiality of your account credentials 
            and for all activities that occur under your account. You must provide accurate and 
            complete information when creating an account.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">3. Trip Listings</h2>
          <p className="text-muted-foreground leading-relaxed">
            Users who create trip listings are responsible for the accuracy of their listings. 
            Tripzi does not guarantee the quality, safety, or legality of any trips listed on 
            the platform. Users participate in trips at their own risk.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">4. User Conduct</h2>
          <p className="text-muted-foreground leading-relaxed">
            You agree not to use the platform for any unlawful purpose, harass other users, 
            post false or misleading information, or interfere with the proper functioning 
            of the platform.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">5. Payments</h2>
          <p className="text-muted-foreground leading-relaxed">
            All financial transactions between users are conducted at their own discretion. 
            Tripzi is not responsible for any disputes arising from payments made between users 
            for trip-related expenses.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">6. Limitation of Liability</h2>
          <p className="text-muted-foreground leading-relaxed">
            Tripzi shall not be liable for any indirect, incidental, special, or consequential 
            damages arising from your use of the platform or participation in any trips 
            organized through the platform.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">7. Modifications</h2>
          <p className="text-muted-foreground leading-relaxed">
            We reserve the right to modify these terms at any time. Continued use of the 
            platform after any modifications constitutes acceptance of the updated terms.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">8. Contact</h2>
          <p className="text-muted-foreground leading-relaxed">
            For any questions regarding these Terms and Conditions, please contact us at 
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

export default Terms;
