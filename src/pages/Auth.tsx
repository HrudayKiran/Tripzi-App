import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mail, Lock, User, Phone, ChevronLeft, Eye, EyeOff, ArrowRight, UserPlus, LogIn } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import authHero from "@/assets/auth-hero.jpg";
import tripziLogo from "@/assets/tripzi-logo.png";

type AuthView = "main" | "signin" | "signup";

// Indian country code as default, with common alternatives
const countryCodes = [
  { code: "+91", country: "India" },
  { code: "+1", country: "USA" },
  { code: "+44", country: "UK" },
  { code: "+971", country: "UAE" },
  { code: "+65", country: "Singapore" },
  { code: "+60", country: "Malaysia" },
  { code: "+61", country: "Australia" },
];

const Auth = () => {
  const navigate = useNavigate();
  const { signIn, signUp, signInWithGoogle, user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [view, setView] = useState<AuthView>("main");
  const [showPassword, setShowPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [countryCode, setCountryCode] = useState("+91");
  
  const [signInData, setSignInData] = useState({ email: "", password: "" });
  const [signUpData, setSignUpData] = useState({
    fullName: "",
    email: "",
    phoneNumber: "",
    password: "",
    confirmPassword: "",
  });

  useEffect(() => {
    if (user) {
      navigate("/home");
    }
  }, [user, navigate]);

  useEffect(() => {
    const handleFocus = () => setIsLoading(false);
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, []);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signInData.email || !signInData.password) {
      toast.error("Please fill in all fields");
      return;
    }
    setIsLoading(true);
    const { error } = await signIn(signInData.email, signInData.password);
    if (error) {
      toast.error(error.message?.includes("Invalid login") ? "Invalid email or password" : error.message);
    }
    setIsLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signUpData.email || !signUpData.password || !signUpData.fullName) {
      toast.error("Please fill in all required fields");
      return;
    }
    if (signUpData.password !== signUpData.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    if (signUpData.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (!agreedToTerms) {
      toast.error("Please agree to the Terms of Service");
      return;
    }
    setIsLoading(true);
    const fullPhoneNumber = signUpData.phoneNumber ? `${countryCode}${signUpData.phoneNumber}` : "";
    const { error } = await signUp(signUpData.email, signUpData.password, signUpData.fullName, fullPhoneNumber);
    if (error) {
      toast.error(error.message?.includes("already registered") ? "An account with this email already exists" : error.message);
    } else {
      toast.success("Account created! Check your email to verify.");
    }
    setIsLoading(false);
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    const { error } = await signInWithGoogle();
    if (error) toast.error(error.message);
  };

  // Main auth selection view - matching the design reference
  if (view === "main") {
    return (
      <div className="min-h-screen relative overflow-hidden safe-top safe-bottom">
        {/* Background Image */}
        <div className="absolute inset-0">
          <img
            src={authHero}
            alt="Adventure background"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background/20" />
        </div>

        {/* Logo at top */}
        <div className="absolute top-8 left-1/2 -translate-x-1/2 z-10">
          <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center backdrop-blur-sm border border-primary/30">
            <img src={tripziLogo} alt="Tripzi" className="w-7 h-7" />
          </div>
        </div>

        {/* Bottom card */}
        <div className="absolute bottom-0 left-0 right-0 bg-card rounded-t-[2.5rem] p-6 pt-10 animate-slide-up shadow-2xl">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-display font-bold text-foreground mb-3">
              Start Your<br />Adventure
            </h1>
            <p className="text-muted-foreground text-base">
              Join thousands of solo travelers<br />exploring the world.
            </p>
          </div>

          <div className="space-y-4">
            {/* Google button */}
            <Button
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              className="w-full h-14 rounded-2xl text-base font-semibold"
            >
              <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5 mr-3" />
              Continue with Google
            </Button>

            {/* Divider */}
            <div className="flex items-center gap-4">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Or Continue With</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* Social buttons row */}
            <div className="flex justify-center gap-4">
              <Button variant="outline" size="icon" className="w-14 h-14 rounded-full border-2">
                <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                </svg>
              </Button>
              <Button variant="outline" size="icon" className="w-14 h-14 rounded-full border-2">
                <svg viewBox="0 0 24 24" className="w-6 h-6 fill-[#1877F2]">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
              </Button>
            </div>

            {/* Email buttons */}
            <Button
              variant="secondary"
              onClick={() => setView("signup")}
              className="w-full h-14 rounded-2xl text-base font-semibold bg-primary/10 text-primary hover:bg-primary/20"
            >
              <UserPlus className="w-5 h-5 mr-2" />
              Sign Up with Email
            </Button>

            <Button
              variant="outline"
              onClick={() => setView("signin")}
              className="w-full h-14 rounded-2xl text-base font-semibold border-2"
            >
              <LogIn className="w-5 h-5 mr-2" />
              Sign In with Email
            </Button>
          </div>

          <p className="text-center text-xs text-muted-foreground mt-6 leading-relaxed">
            By continuing, you agree to our{" "}
            <span className="text-primary font-medium">Terms of Service</span>
            <br />& <span className="text-primary font-medium">Privacy Policy</span>.
          </p>
        </div>
      </div>
    );
  }

  // Sign In view
  if (view === "signin") {
    return (
      <div className="min-h-screen bg-background p-6 safe-top safe-bottom">
        <button
          onClick={() => setView("main")}
          className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mb-8"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <div className="mb-8">
          <div className="w-16 h-16 bg-accent rounded-2xl flex items-center justify-center mb-6">
            <img src={tripziLogo} alt="Tripzi" className="w-10 h-10" />
          </div>
          <h1 className="text-3xl font-display font-bold text-foreground mb-2">Welcome Back</h1>
          <p className="text-muted-foreground">Sign in to plan your next adventure.</p>
        </div>

        <form onSubmit={handleSignIn} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium">Email Address</Label>
            <Input
              id="email"
              type="email"
              placeholder="traveler@example.com"
              value={signInData.email}
              onChange={(e) => setSignInData({ ...signInData, email: e.target.value })}
              className="h-14 rounded-2xl px-4 text-base"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm font-medium">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={signInData.password}
                onChange={(e) => setSignInData({ ...signInData, password: e.target.value })}
                className="h-14 rounded-2xl px-4 pr-12 text-base"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => navigate("/forgot-password")}
              className="text-sm text-primary font-medium"
            >
              Forgot Password?
            </button>
          </div>

          <Button type="submit" disabled={isLoading} className="w-full h-14 rounded-2xl text-base font-semibold">
            {isLoading ? "Signing in..." : "Sign In"}
          </Button>

          <div className="flex items-center gap-4 pt-4">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">Or continue with</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <div className="flex justify-center gap-4">
            <Button type="button" variant="outline" size="icon" onClick={handleGoogleSignIn} className="w-14 h-14 rounded-full border-2">
              <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
            </Button>
            <Button type="button" variant="outline" size="icon" className="w-14 h-14 rounded-full border-2">
              <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
              </svg>
            </Button>
          </div>
        </form>

        <p className="text-center text-sm text-muted-foreground mt-8">
          Don't have an account?{" "}
          <button onClick={() => setView("signup")} className="text-primary font-semibold">
            Sign Up
          </button>
        </p>
      </div>
    );
  }

  // Sign Up view with country code selector for phone
  return (
    <div className="min-h-screen bg-background p-6 safe-top safe-bottom overflow-y-auto">
      <button
        onClick={() => setView("main")}
        className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mb-6"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>

      {/* Community indicator */}
      <div className="flex items-center gap-2 mb-4">
        <div className="flex -space-x-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="w-7 h-7 rounded-full bg-muted border-2 border-background overflow-hidden">
              <img src={`https://i.pravatar.cc/28?img=${i + 15}`} alt="User" className="w-full h-full object-cover" />
            </div>
          ))}
          <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center border-2 border-background">
            <span className="text-[10px] font-bold text-primary-foreground">+2k</span>
          </div>
        </div>
        <span className="text-xs text-muted-foreground">Join the community</span>
      </div>

      <div className="mb-6">
        <h1 className="text-3xl font-display font-bold text-foreground">
          Create your<br /><span className="text-primary">account</span>
        </h1>
        <p className="text-muted-foreground mt-2">
          Connect with thousands of solo travelers exploring the world together.
        </p>
      </div>

      <form onSubmit={handleSignUp} className="space-y-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium">Email Address</Label>
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              type="email"
              placeholder="hello@example.com"
              value={signUpData.email}
              onChange={(e) => setSignUpData({ ...signUpData, email: e.target.value })}
              className="h-14 rounded-2xl pl-12 text-base"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium">Full Name</Label>
          <div className="relative">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="Your full name"
              value={signUpData.fullName}
              onChange={(e) => setSignUpData({ ...signUpData, fullName: e.target.value })}
              className="h-14 rounded-2xl pl-12 text-base"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium">Phone Number (Optional)</Label>
          <div className="flex gap-2">
            <Select value={countryCode} onValueChange={setCountryCode}>
              <SelectTrigger className="w-28 h-14 rounded-2xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {countryCodes.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {c.code} {c.country}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative flex-1">
              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                type="tel"
                placeholder="9876543210"
                value={signUpData.phoneNumber}
                onChange={(e) => setSignUpData({ ...signUpData, phoneNumber: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                className="h-14 rounded-2xl pl-12 text-base"
              />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium">Password</Label>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              type={showPassword ? "text" : "password"}
              placeholder="Create a password"
              value={signUpData.password}
              onChange={(e) => setSignUpData({ ...signUpData, password: e.target.value })}
              className="h-14 rounded-2xl pl-12 pr-12 text-base"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          {/* Password strength indicator */}
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  signUpData.password.length >= i * 2
                    ? i <= 2 ? "bg-destructive" : i <= 3 ? "bg-yellow-500" : "bg-success"
                    : "bg-muted"
                }`}
              />
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium">Confirm Password</Label>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              type="password"
              placeholder="Re-enter password"
              value={signUpData.confirmPassword}
              onChange={(e) => setSignUpData({ ...signUpData, confirmPassword: e.target.value })}
              className="h-14 rounded-2xl pl-12 text-base"
            />
          </div>
        </div>

        <div className="flex items-start gap-3 py-2">
          <Checkbox
            id="terms"
            checked={agreedToTerms}
            onCheckedChange={(checked) => setAgreedToTerms(checked === true)}
            className="mt-0.5"
          />
          <label htmlFor="terms" className="text-sm text-muted-foreground leading-tight">
            I agree to the <span className="text-primary font-medium">Terms of Service</span> and{" "}
            <span className="text-primary font-medium">Privacy Policy</span>.
          </label>
        </div>

        <Button type="submit" disabled={isLoading} className="w-full h-14 rounded-2xl text-base font-semibold">
          {isLoading ? "Creating account..." : "Sign Up"}
          <ArrowRight className="ml-2 w-5 h-5" />
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground mt-6 pb-6">
        Already a member?{" "}
        <button onClick={() => setView("signin")} className="text-primary font-semibold">
          Log In
        </button>
      </p>
    </div>
  );
};

export default Auth;
