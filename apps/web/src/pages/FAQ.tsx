import { useState, useMemo } from "react";
import { PageLayout } from "@/components/layouts/PageLayout";
import { useFAQs, FAQ } from "@/hooks/useFAQs";
import { ChevronDown, Search, HelpCircle, Package, Truck, RotateCcw, Ruler, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";
import { SEOHead } from "@/components/SEOHead";

// Static FAQs — always visible even if database is empty
const STATIC_FAQS: FAQ[] = [
  {
    id: "static-1",
    category: "ordering",
    question: "How do I track my order?",
    answer: "Go to My Orders page or visit /tracking. Enter your Order ID (e.g., ORD-XXXXXXXXXX-XXXX) in the search box and click the Search button. You will see the current status and shipment history for your order.",
    sort_order: 1,
    is_active: true,
    created_at: "",
    updated_at: "",
  },
  {
    id: "static-2",
    category: "ordering",
    question: "How do I cancel my order?",
    answer: "To cancel an order, go to My Orders and click 'Request Cancel' next to the order. Cancellation is available for orders in Pending, Confirmed, or Processing status. Once your request is submitted, our support team will review it and process it within 24 hours.",
    sort_order: 2,
    is_active: true,
    created_at: "",
    updated_at: "",
  },
  {
    id: "static-3",
    category: "ordering",
    question: "What is the delivery time?",
    answer: "Standard delivery takes 5-7 business days within India. Express delivery (2-3 business days) is available for select pin codes. You will receive a tracking number once your order is shipped, and you can track it on the Tracking page.",
    sort_order: 3,
    is_active: true,
    created_at: "",
    updated_at: "",
  },
  {
    id: "static-4",
    category: "returns",
    question: "What is the return policy?",
    answer: "We offer a 7-day return policy from the date of delivery. Items must be unused, in their original packaging, and with all tags attached. To initiate a return, visit My Orders, select the order, and click 'Request Return'. Our team will arrange a free pickup.",
    sort_order: 1,
    is_active: true,
    created_at: "",
    updated_at: "",
  },
  {
    id: "static-5",
    category: "returns",
    question: "How does the refund process work?",
    answer: "Once we receive your returned item and verify its condition, we process the refund within 3-5 business days. Refunds are credited to the original payment method. For Cash on Delivery orders, the refund is credited to your bank account. You can track your refund status on the My Orders page under 'Refund Status'.",
    sort_order: 2,
    is_active: true,
    created_at: "",
    updated_at: "",
  },
  {
    id: "static-6",
    category: "shipping",
    question: "What are the shipping charges?",
    answer: "We offer free shipping on orders above ₹499. For orders below ₹499, a flat shipping fee of ₹49 applies. Cash on Delivery orders have an additional ₹11 COD handling fee. Shipping is available across India.",
    sort_order: 1,
    is_active: true,
    created_at: "",
    updated_at: "",
  },
  {
    id: "static-7",
    category: "shipping",
    question: "Do you ship across all of India?",
    answer: "Yes, we ship to most pin codes across India. You can enter your pin code during checkout to confirm availability. If your pin code is not serviceable, you will be notified during the checkout process.",
    sort_order: 2,
    is_active: true,
    created_at: "",
    updated_at: "",
  },
  {
    id: "static-8",
    category: "payments",
    question: "My payment failed. What should I do?",
    answer: "If your payment fails, please check your internet connection and try again. Make sure your card details or UPI ID are correct. If the amount was deducted but the order was not placed, it will be automatically refunded to your original payment method within 5-7 business days. For further help, contact us at pebricin@gmail.com.",
    sort_order: 1,
    is_active: true,
    created_at: "",
    updated_at: "",
  },
  {
    id: "static-9",
    category: "payments",
    question: "What payment methods do you accept?",
    answer: "We accept Cash on Delivery (COD), UPI (PhonePe, Google Pay, Paytm), Debit/Credit Cards, and Net Banking. All online payments are processed securely through our payment gateway.",
    sort_order: 2,
    is_active: true,
    created_at: "",
    updated_at: "",
  },
  {
    id: "static-10",
    category: "payments",
    question: "How do I use a coupon code?",
    answer: "During checkout, you will see a 'Coupon Code' field. Enter your coupon code and click 'Apply'. If the coupon is valid and applicable to your order, the discount will be applied automatically to your total. Each coupon can typically be used once per account.",
    sort_order: 3,
    is_active: true,
    created_at: "",
    updated_at: "",
  },
  {
    id: "static-11",
    category: "general",
    question: "How do I contact customer support?",
    answer: "You can reach us at pebricin@gmail.com or call +91 81675 25752. Our support team is available Monday to Saturday, 10 AM to 6 PM IST. You can also use the Live Chat widget on our website for instant support.",
    sort_order: 1,
    is_active: true,
    created_at: "",
    updated_at: "",
  },
];

const categoryConfig: Record<string, { label: string; icon: React.ElementType }> = {
  ordering: { label: "Ordering", icon: Package },
  shipping: { label: "Shipping", icon: Truck },
  returns: { label: "Returns & Exchanges", icon: RotateCcw },
  sizing: { label: "Sizing", icon: Ruler },
  payments: { label: "Payments", icon: CreditCard },
  general: { label: "General", icon: HelpCircle },
};

export default function FAQ() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { data: dbFaqs = [], isLoading } = useFAQs();

  // Merge database FAQs with static FAQs — database takes priority (deduplicate by question text)
  const faqs = useMemo(() => {
    if (dbFaqs.length === 0) return STATIC_FAQS;
    const dbQuestions = new Set(dbFaqs.map((f) => f.question.toLowerCase()));
    const uniqueStatic = STATIC_FAQS.filter(
      (f) => !dbQuestions.has(f.question.toLowerCase())
    );
    return [...dbFaqs, ...uniqueStatic];
  }, [dbFaqs]);

  const categories = [...new Set(faqs.map((f) => f.category))];

  const filteredFAQs = faqs.filter((faq) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      faq.question.toLowerCase().includes(q) ||
      faq.answer.toLowerCase().includes(q);
    
    const matchesCategory = !selectedCategory || faq.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  const groupedFAQs = filteredFAQs.reduce((acc, faq) => {
    if (!acc[faq.category]) {
      acc[faq.category] = [];
    }
    acc[faq.category].push(faq);
    return acc;
  }, {} as Record<string, typeof faqs>);

  const faqJsonLd = useMemo(() => ({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  }), [faqs]);

  return (
    <PageLayout>
      <SEOHead
        title="Frequently Asked Questions"
        description="Find answers to common questions about Pebric orders, shipping, returns, sizing, and payments. Get quick help from our FAQ."
        keywords="Pebric FAQ, pet clothing questions, order help, shipping info, returns policy, sizing guide"
        jsonLd={faqJsonLd}
      />
      <section className="bg-muted py-16 md:py-24">
        <div className="container mx-auto px-6 text-center">
          <p className="mb-3 font-body text-xs uppercase tracking-[0.3em] text-muted-foreground">
            Help Center
          </p>
          <h1 className="mb-4 font-display text-5xl font-medium tracking-tight md:text-6xl">
            How can we help?
          </h1>
          <p className="mx-auto mb-8 max-w-xl font-body text-lg text-muted-foreground">
            Find answers to frequently asked questions about orders, shipping, returns, and more.
          </p>

          {/* Search */}
          <div className="relative mx-auto max-w-xl">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search for answers..."
              className="w-full border border-border bg-background py-4 pl-12 pr-4 font-body placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-foreground"
            />
          </div>
        </div>
      </section>

      <section className="py-6 md:py-8">
        <div className="container mx-auto px-6">
          {/* Category Pills */}
          <div className="mb-8 flex flex-wrap justify-center gap-2">
            <button
              onClick={() => setSelectedCategory(null)}
              className={cn(
                "flex items-center gap-2 rounded-full px-4 py-2 font-body text-sm transition-colors",
                !selectedCategory
                  ? "bg-foreground text-background"
                  : "bg-muted hover:bg-muted/80"
              )}
            >
              All Topics
            </button>
            {categories.map((cat) => {
              const config = categoryConfig[cat] || categoryConfig.general;
              const Icon = config.icon;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={cn(
                    "flex items-center gap-2 rounded-full px-4 py-2 font-body text-sm transition-colors",
                    selectedCategory === cat
                      ? "bg-foreground text-background"
                      : "bg-muted hover:bg-muted/80"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {config.label}
                </button>
              );
            })}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : filteredFAQs.length === 0 ? (
            <div className="py-20 text-center">
              <HelpCircle className="mx-auto mb-4 h-16 w-16 text-muted-foreground" />
              <p className="mb-2 font-display text-2xl">No results found</p>
              <p className="font-body text-muted-foreground">
                Try adjusting your search or browse all topics
              </p>
            </div>
          ) : (
            <div className="mx-auto max-w-3xl space-y-8">
              {Object.entries(groupedFAQs).map(([category, categoryFaqs]) => {
                const config = categoryConfig[category] || categoryConfig.general;
                const Icon = config.icon;
                return (
                  <div key={category}>
                    <h2 className="mb-4 flex items-center gap-2 font-display text-xl">
                      <Icon className="h-5 w-5" />
                      {config.label}
                    </h2>
                    <div className="space-y-2">
                      {categoryFaqs
                        .sort((a, b) => a.sort_order - b.sort_order)
                        .map((faq) => (
                          <div
                            key={faq.id}
                            className="border border-border bg-card"
                          >
                            <button
                              onClick={() =>
                                setExpandedId(expandedId === faq.id ? null : faq.id)
                              }
                              className="flex w-full items-center justify-between p-4 text-left"
                            >
                              <span className="font-body font-medium pr-4">
                                {faq.question}
                              </span>
                              <ChevronDown
                                className={cn(
                                  "h-5 w-5 shrink-0 transition-transform",
                                  expandedId === faq.id && "rotate-180"
                                )}
                              />
                            </button>
                            {expandedId === faq.id && (
                              <div className="border-t border-border px-4 py-4">
                                <p className="font-body text-muted-foreground whitespace-pre-line">
                                  {faq.answer}
                                </p>
                              </div>
                            )}
                          </div>
                        ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Contact CTA */}
          <div className="mx-auto mt-16 max-w-2xl rounded-lg border border-border bg-muted p-8 text-center">
            <h3 className="mb-2 font-display text-2xl">Still have questions?</h3>
            <p className="mb-6 font-body text-muted-foreground">
              Can't find the answer you're looking for? Our support team is here to help.
            </p>
            <a
              href="/contact"
              className="inline-block bg-foreground px-8 py-3 font-body text-sm text-background transition-opacity hover:opacity-90"
            >
              Contact Support
            </a>
          </div>
        </div>
      </section>
    </PageLayout>
  );
}
