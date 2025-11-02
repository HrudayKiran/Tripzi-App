import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import Auth from "./pages/Auth";
import Home from "./pages/Home";
import Feed from "./pages/Feed";
import Trips from "./pages/Trips";
import Profile from "./pages/Profile";
import UpdateProfile from "./pages/UpdateProfile";
import Settings from "./pages/Settings";
import ForgotPassword from "./pages/ForgotPassword";
import CreateTrip from "./pages/CreateTrip";
import TripDetails from "./pages/TripDetails";
import Chat from "./pages/Chat";
import KYCRequest from "./pages/KYCRequest";
import AdminDashboard from "./pages/AdminDashboard";
import NotFound from "./pages/NotFound";
import Layout from "./components/Layout";
import { ProtectedAdminRoute } from "./components/ProtectedAdminRoute";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/" element={<ProtectedRoute><Layout><Home /></Layout></ProtectedRoute>} />
              <Route path="/feed" element={<ProtectedRoute><Layout><Feed /></Layout></ProtectedRoute>} />
              <Route path="/trips" element={<ProtectedRoute><Layout><Trips /></Layout></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><Layout><Profile /></Layout></ProtectedRoute>} />
              <Route path="/update-profile" element={<ProtectedRoute><Layout><UpdateProfile /></Layout></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><Layout><Settings /></Layout></ProtectedRoute>} />
              <Route path="/create-trip" element={<ProtectedRoute><CreateTrip /></ProtectedRoute>} />
              <Route path="/create-trip/:tripId" element={<ProtectedRoute><CreateTrip /></ProtectedRoute>} />
              <Route path="/trip/:id" element={<ProtectedRoute><TripDetails /></ProtectedRoute>} />
              <Route path="/chat/:userId" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
              <Route path="/kyc-request" element={<ProtectedRoute><Layout><KYCRequest /></Layout></ProtectedRoute>} />
              <Route path="/admin/dashboard" element={<ProtectedAdminRoute><Layout><AdminDashboard /></Layout></ProtectedAdminRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
