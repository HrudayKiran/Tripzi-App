import { useEffect, useState } from "react";
import { Star, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

interface Review {
  id: string;
  rating: number;
  review: string | null;
  created_at: string;
  user_id: string;
  profile?: {
    full_name: string | null;
    avatar_url: string | null;
  };
}

interface TripReviewsProps {
  tripId: string;
  tripStatus: string;
  tripEndDate: string;
  hasJoined: boolean;
}

export const TripReviews = ({ tripId, tripStatus, tripEndDate, hasJoined }: TripReviewsProps) => {
  const { user, profile: userProfile } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [userReview, setUserReview] = useState<Review | null>(null);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isPastTrip = new Date(tripEndDate) < new Date();
  const canReview = hasJoined && isPastTrip && user;

  useEffect(() => {
    fetchReviews();
  }, [tripId, user]);

  const fetchReviews = async () => {
    const { data } = await supabase
      .from("trip_reviews")
      .select("*")
      .eq("trip_id", tripId)
      .order("created_at", { ascending: false });

    if (data) {
      const userIds = [...new Set(data.map((r) => r.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", userIds);

      const profilesMap: Record<string, any> = {};
      profiles?.forEach((p) => (profilesMap[p.id] = p));

      const reviewsWithProfiles = data.map((r) => ({ ...r, profile: profilesMap[r.user_id] }));
      setReviews(reviewsWithProfiles);

      // Check if current user has already reviewed
      if (user) {
        const existing = reviewsWithProfiles.find((r) => r.user_id === user.id);
        if (existing) {
          setUserReview(existing);
          setRating(existing.rating);
          setReviewText(existing.review || "");
        }
      }
    }
  };

  const handleSubmitReview = async () => {
    if (!user || rating === 0) {
      toast({ title: "Please select a rating", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      if (userReview) {
        // Update existing review
        const { error } = await supabase
          .from("trip_reviews")
          .update({ rating, review: reviewText.trim() || null })
          .eq("id", userReview.id);

        if (error) throw error;
        toast({ title: "Review updated!" });
      } else {
        // Create new review
        const { error } = await supabase.from("trip_reviews").insert({
          trip_id: tripId,
          user_id: user.id,
          rating,
          review: reviewText.trim() || null,
        });

        if (error) throw error;
        toast({ title: "Review submitted!" });
      }

      fetchReviews();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const averageRating = reviews.length > 0
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
    : null;

  const getTimeAgo = (date: string) => {
    const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return "just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return new Date(date).toLocaleDateString();
  };

  return (
    <div className="space-y-4">
      {/* Header with average rating */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-lg">Reviews</h3>
        {averageRating && (
          <div className="flex items-center gap-1">
            <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
            <span className="font-bold">{averageRating}</span>
            <span className="text-sm text-muted-foreground">({reviews.length})</span>
          </div>
        )}
      </div>

      {/* Review form for eligible users */}
      {canReview && (
        <div className="bg-muted/50 rounded-xl p-4 space-y-3">
          <p className="text-sm font-medium">
            {userReview ? "Update your review" : "Rate this trip"}
          </p>
          
          {/* Star rating */}
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                className="p-1"
              >
                <Star
                  className={`h-7 w-7 transition-colors ${
                    star <= (hoverRating || rating)
                      ? "fill-yellow-400 text-yellow-400"
                      : "text-muted-foreground"
                  }`}
                />
              </button>
            ))}
          </div>

          <Textarea
            placeholder="Share your experience (optional)"
            value={reviewText}
            onChange={(e) => setReviewText(e.target.value)}
            className="min-h-[80px] resize-none"
          />

          <Button
            onClick={handleSubmitReview}
            disabled={submitting || rating === 0}
            className="w-full gap-2"
          >
            <Send className="h-4 w-4" />
            {submitting ? "Submitting..." : userReview ? "Update Review" : "Submit Review"}
          </Button>
        </div>
      )}

      {/* Reviews list */}
      {reviews.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          No reviews yet. {isPastTrip && hasJoined ? "Be the first to review!" : ""}
        </p>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => (
            <div key={review.id} className="flex gap-3">
              <Avatar className="h-10 w-10 shrink-0">
                <AvatarImage src={review.profile?.avatar_url || ""} />
                <AvatarFallback>{review.profile?.full_name?.charAt(0) || "U"}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-sm">{review.profile?.full_name || "Traveler"}</p>
                  <span className="text-xs text-muted-foreground">{getTimeAgo(review.created_at)}</span>
                </div>
                <div className="flex gap-0.5 my-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`h-4 w-4 ${
                        star <= review.rating
                          ? "fill-yellow-400 text-yellow-400"
                          : "text-muted-foreground/30"
                      }`}
                    />
                  ))}
                </div>
                {review.review && (
                  <p className="text-sm text-muted-foreground">{review.review}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};