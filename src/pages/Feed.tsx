import { useState } from "react";
import { Heart, MessageCircle, Share2, MapPin, Plus } from "lucide-react";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import heroImage from "@/assets/hero-travel.jpg";

const Feed = () => {
  const [posts] = useState([
    {
      id: 1,
      author: { name: "Sarah Johnson", avatar: "", username: "@sarahj" },
      date: "2 days ago",
      location: "Santorini, Greece",
      cost: "$3,500",
      description: "Amazing sunset views and delicious food! The white-washed buildings against the blue sea are breathtaking. Highly recommend staying in Oia.",
      images: [heroImage],
      likes: 234,
      comments: 45,
      shares: 12,
    },
    {
      id: 2,
      author: { name: "Mike Chen", avatar: "", username: "@mikec" },
      date: "5 days ago",
      location: "Kyoto, Japan",
      cost: "$2,100",
      description: "Cherry blossoms in full bloom at Maruyama Park. The temples are stunning and the traditional tea ceremony was unforgettable.",
      images: [heroImage],
      likes: 567,
      comments: 89,
      shares: 34,
    },
  ]);

  const handleLike = (postId: number) => {
    console.log("Liked post:", postId);
  };

  return (
    <div className="min-h-screen pb-24 bg-muted/30">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-gradient-to-r from-primary to-accent p-4 shadow-lg">
        <h1 className="text-2xl font-bold text-primary-foreground">Travel Feed</h1>
      </div>

      {/* Posts */}
      <div className="p-4 space-y-4">
        {posts.map((post, index) => (
          <Card 
            key={post.id} 
            className="overflow-hidden shadow-lg animate-fade-up"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <CardHeader className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarImage src={post.author.avatar} />
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {post.author.name.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold">{post.author.name}</p>
                    <p className="text-sm text-muted-foreground">{post.date}</p>
                  </div>
                </div>
                <Badge variant="secondary">{post.cost}</Badge>
              </div>
              <div className="flex items-center gap-1 text-primary">
                <MapPin className="h-4 w-4" />
                <span className="text-sm font-medium">{post.location}</span>
              </div>
            </CardHeader>

            <CardContent className="space-y-3 p-0">
              <div className="relative h-64 overflow-hidden">
                <img 
                  src={post.images[0]} 
                  alt="Post" 
                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                />
              </div>
              <p className="px-4 text-sm">{post.description}</p>
            </CardContent>

            <CardFooter className="flex items-center justify-between border-t pt-4">
              <Button 
                variant="ghost" 
                size="sm" 
                className="gap-2"
                onClick={() => handleLike(post.id)}
              >
                <Heart className="h-4 w-4" />
                <span>{post.likes}</span>
              </Button>
              <Button variant="ghost" size="sm" className="gap-2">
                <MessageCircle className="h-4 w-4" />
                <span>{post.comments}</span>
              </Button>
              <Button variant="ghost" size="sm" className="gap-2">
                <Share2 className="h-4 w-4" />
                <span>{post.shares}</span>
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      {/* Floating Action Button */}
      <Button 
        size="lg"
        className="fixed bottom-24 right-6 h-14 w-14 rounded-full shadow-xl animate-scale-in bg-gradient-to-r from-secondary to-accent hover:shadow-2xl transition-all duration-300"
      >
        <Plus className="h-6 w-6" />
      </Button>
    </div>
  );
};

export default Feed;
