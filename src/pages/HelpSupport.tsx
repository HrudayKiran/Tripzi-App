import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Send, MessageCircle, Mail, Phone, FileQuestion, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { toast } from "@/hooks/use-toast";

const HelpSupport = () => {
  const navigate = useNavigate();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const faqs = [
    {
      question: "How do I create a trip?",
      answer: "Tap the + button at the bottom of the home screen, fill in your trip details including destination, dates, cost, and description, then tap 'Create Trip'."
    },
    {
      question: "How do I join someone else's trip?",
      answer: "Browse trips on the home page, find one you like, and tap 'Join Trip'. The trip owner will be notified of your interest."
    },
    {
      question: "What is KYC verification?",
      answer: "KYC (Know Your Customer) verification helps us ensure all travelers are real people. You need to verify your identity to join trips for safety reasons."
    },
    {
      question: "How do I message other travelers?",
      answer: "Visit their profile and tap the message icon, or go to the Messages tab to start a conversation."
    },
    {
      question: "Can I edit or delete my trip?",
      answer: "Yes! Go to your trip, tap the three dots menu, and select Edit or Delete."
    }
  ];

  const handleSubmit = async () => {
    if (!subject.trim() || !message.trim()) {
      toast({
        title: "Missing information",
        description: "Please fill in both subject and message",
        variant: "destructive",
      });
      return;
    }

    setSending(true);
    // Simulate sending
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    toast({
      title: "Message sent!",
      description: "Our support team will get back to you within 24 hours.",
    });
    
    setSubject("");
    setMessage("");
    setSending(false);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b p-4 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-semibold">Help & Support</h1>
      </div>

      <div className="p-4 space-y-6 pb-24">
        {/* Contact Options */}
        <div className="grid grid-cols-3 gap-3">
          <button className="flex flex-col items-center gap-2 p-4 bg-card rounded-2xl shadow-sm hover:shadow-md transition-all">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
              <Mail className="h-6 w-6 text-primary" />
            </div>
            <span className="text-xs font-medium">Email</span>
          </button>
          <button className="flex flex-col items-center gap-2 p-4 bg-card rounded-2xl shadow-sm hover:shadow-md transition-all">
            <div className="w-12 h-12 bg-success/10 rounded-full flex items-center justify-center">
              <MessageCircle className="h-6 w-6 text-success" />
            </div>
            <span className="text-xs font-medium">Live Chat</span>
          </button>
          <button className="flex flex-col items-center gap-2 p-4 bg-card rounded-2xl shadow-sm hover:shadow-md transition-all">
            <div className="w-12 h-12 bg-accent/10 rounded-full flex items-center justify-center">
              <Phone className="h-6 w-6 text-accent" />
            </div>
            <span className="text-xs font-medium">Call Us</span>
          </button>
        </div>

        {/* FAQs */}
        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <FileQuestion className="h-5 w-5 text-primary" />
            Frequently Asked Questions
          </h2>
          <Accordion type="single" collapsible className="space-y-2">
            {faqs.map((faq, index) => (
              <AccordionItem 
                key={index} 
                value={`faq-${index}`}
                className="bg-card rounded-xl border-none px-4"
              >
                <AccordionTrigger className="text-sm font-medium hover:no-underline py-4">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground pb-4">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>

        {/* Contact Form */}
        <div className="bg-card rounded-2xl p-4 space-y-4">
          <h2 className="text-lg font-semibold">Send us a message</h2>
          <div className="space-y-3">
            <Input
              placeholder="Subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="rounded-xl"
            />
            <Textarea
              placeholder="Describe your issue or question..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="min-h-[120px] rounded-xl"
            />
            <Button 
              onClick={handleSubmit} 
              className="w-full rounded-xl gap-2"
              disabled={sending}
            >
              <Send className="h-4 w-4" />
              {sending ? "Sending..." : "Send Message"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HelpSupport;