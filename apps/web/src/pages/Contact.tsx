import { useState } from "react";
import { Mail, Phone, MapPin, Send, Clock } from "lucide-react";
import { PageLayout } from "@/components/layouts/PageLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { SEOHead } from "@/components/SEOHead";

export default function Contact() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    setTimeout(() => {
      setIsSubmitting(false);
      toast.success("Message sent!", {
        description: "We'll get back to you within 24 hours.",
      });
      setName("");
      setEmail("");
      setSubject("");
      setMessage("");
    }, 1000);
  };

  return (
    <PageLayout showNewsletter={false}>
      <SEOHead
        title="Contact Us"
        description="Get in touch with the Pebric team. Reach us by email, phone, or visit our store. We respond within 24 hours."
        keywords="contact Pebric, customer support, pet fashion help, reach us"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "ContactPage",
          name: "Contact Pebric",
          description: "Get in touch with the Pebric team.",
          url: "https://pebric.vercel.app/contact",
        }}
      />
      {/* Hero */}
      <section className="bg-muted py-16 md:py-24">
        <div className="container mx-auto px-6 text-center">
          <p className="mb-3 font-body text-xs uppercase tracking-[0.3em] text-muted-foreground">
            Get in Touch
          </p>
          <h1 className="mb-4 font-display text-5xl font-medium tracking-tight md:text-6xl">
            Contact Us
          </h1>
          <p className="mx-auto max-w-xl font-body text-lg text-muted-foreground">
            Have a question or feedback? We'd love to hear from you.
          </p>
        </div>
      </section>

      <section className="py-16 md:py-24">
        <div className="container mx-auto px-6">
          <div className="grid gap-12 lg:grid-cols-3 lg:gap-16">
            {/* Contact Info */}
            <div className="space-y-8">
              <div>
                <h2 className="mb-6 font-display text-2xl font-medium">Get in Touch</h2>
                <div className="space-y-6">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center bg-muted">
                      <Mail className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-body text-sm font-medium">Email</p>
                      <a href="mailto:pebricin@gmail.com" className="font-body text-muted-foreground hover:text-foreground">
                        pebricin@gmail.com
                      </a>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center bg-muted">
                      <Phone className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-body text-sm font-medium">Phone</p>
                      <a href="tel:+918167525752" className="font-body text-muted-foreground hover:text-foreground">
                        +91 81675 25752
                      </a>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center bg-muted">
                      <MapPin className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-body text-sm font-medium">Address</p>
                      <p className="font-body text-muted-foreground">
                        123 Pet Fashion Street<br />
                        Los Angeles, CA 90210
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center bg-muted">
                      <Clock className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-body text-sm font-medium">Hours</p>
                      <p className="font-body text-muted-foreground">
                        Mon - Fri: 9am - 6pm PST<br />
                        Sat - Sun: 10am - 4pm PST
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Contact Form */}
            <div className="lg:col-span-2">
              <div className="bg-muted p-8 md:p-12">
                <h2 className="mb-6 font-display text-2xl font-medium">Send a Message</h2>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid gap-6 md:grid-cols-2">
                    <div>
                      <label className="mb-2 block font-body text-sm font-medium">Name</label>
                      <Input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Your name"
                        className="h-12 bg-background"
                        required
                      />
                    </div>
                    <div>
                      <label className="mb-2 block font-body text-sm font-medium">Email</label>
                      <Input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="your@email.com"
                        className="h-12 bg-background"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-2 block font-body text-sm font-medium">Subject</label>
                    <Input
                      type="text"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="How can we help?"
                      className="h-12 bg-background"
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-2 block font-body text-sm font-medium">Message</label>
                    <Textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Your message..."
                      className="min-h-[150px] bg-background"
                      required
                    />
                  </div>
                  <Button type="submit" variant="hero" disabled={isSubmitting}>
                    {isSubmitting ? "Sending..." : "Send Message"}
                    <Send className="ml-2 h-4 w-4" />
                  </Button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Teaser */}
      <section className="border-t border-border py-16">
        <div className="container mx-auto px-6 text-center">
          <h2 className="mb-4 font-display text-2xl font-medium">Have More Questions?</h2>
          <p className="mb-6 font-body text-muted-foreground">
            Check out our FAQ for quick answers to common questions.
          </p>
          <Button variant="outline">View FAQ</Button>
        </div>
      </section>
    </PageLayout>
  );
}
