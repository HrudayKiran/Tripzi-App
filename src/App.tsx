import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { IncomingCallListener } from "./components/IncomingCall";
import Welcome from "./pages/Welcome";
import Auth from "./pages/Auth";
import Home from "./pages/Home";
import Feed from "./pages/Feed";
import Trips from "./pages/Trips";
import Messages from "./pages/Messages";
import Profile from "./pages/Profile";
import UserProfile from "./pages/UserProfile";
import UpdateProfile from "./pages/UpdateProfile";
import Settings from "./pages/Settings";
import ForgotPassword from "./pages/ForgotPassword";
import CreateTrip from "./pages/CreateTrip";
import TripDetails from "./pages/TripDetails";
import Chat from "./pages/Chat";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import Terms from "./pages/Terms";
import HelpSupport from "./pages/HelpSupport";
import SuggestFeature from "./pages/SuggestFeature";
import Admin from "./pages/Admin";
import GroupChat from "./pages/GroupChat";
import NotFound from "./pages/NotFound";
import Layout from "./components/Layout";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <IncomingCallListener />
            <Routes>
              <Route path="/" element={<Welcome />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/privacy-policy" element={<PrivacyPolicy />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/help-support" element={<ProtectedRoute><HelpSupport /></ProtectedRoute>} />
              <Route path="/suggest-feature" element={<ProtectedRoute><SuggestFeature /></ProtectedRoute>} />
              <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
              <Route path="/home" element={<ProtectedRoute><Layout><Home /></Layout></ProtectedRoute>} />
              <Route path="/feed" element={<ProtectedRoute><Layout><Feed /></Layout></ProtectedRoute>} />
              <Route path="/trips" element={<ProtectedRoute><Layout><Trips /></Layout></ProtectedRoute>} />
              <Route path="/messages" element={<ProtectedRoute><Layout><Messages /></Layout></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><Layout><Profile /></Layout></ProtectedRoute>} />
              <Route path="/profile/:userId" element={<ProtectedRoute><UserProfile /></ProtectedRoute>} />
              <Route path="/update-profile" element={<ProtectedRoute><Layout><UpdateProfile /></Layout></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><Layout><Settings /></Layout></ProtectedRoute>} />
              <Route path="/create-trip" element={<ProtectedRoute><CreateTrip /></ProtectedRoute>} />
              <Route path="/create-trip/:tripId" element={<ProtectedRoute><CreateTrip /></ProtectedRoute>} />
              <Route path="/trip/:id" element={<ProtectedRoute><TripDetails /></ProtectedRoute>} />
              <Route path="/chat/:userId" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
              <Route path="/group-chat/:groupId" element={<ProtectedRoute><GroupChat /></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
