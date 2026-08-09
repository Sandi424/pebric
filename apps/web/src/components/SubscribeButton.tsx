import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RefreshCw, Check } from "lucide-react";

interface SubscribeButtonProps {
  product: any;
  dynamicTotalPrice: number;
  selectedSize?: string;
  selectedPetSize?: string;
  parentQuantity: number;
  petQuantity: number;
}

const frequencies = [
  { value: "weekly", label: "Weekly", discount: "15% off" },
  { value: "biweekly", label: "Every 2 Weeks", discount: "10% off" },
  { value: "monthly", label: "Monthly", discount: "5% off" },
];

export function SubscribeButton({ 
  product, 
  dynamicTotalPrice, 
  selectedSize, 
  selectedPetSize,
  parentQuantity,
  petQuantity
}: SubscribeButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [frequency, setFrequency] = useState("monthly");
  const navigate = useNavigate();

  const selectedFreq = frequencies.find(f => f.value === frequency);
  const discount = frequency === 'weekly' ? 0.15 : frequency === 'biweekly' ? 0.10 : 0.05;
  const discountedTotalPrice = dynamicTotalPrice * (1 - discount);
  
  const isMatchingSet = product.sizes && product.sizes.length > 0 && product.pet_sizes && product.pet_sizes.length > 0;

  const handleSubscribe = () => {
    navigate("/checkout", {
      state: {
        buyNowItems: [{
          id: product.id,
          name: product.name,
          price: product.price * (1 - discount),
          image: product.image_url || "/product-1.jpg",
          ownerSize: selectedSize || "N/A",
          petSize: selectedPetSize || "N/A",
          slug: product.slug,
          quantity: (selectedSize ? parentQuantity : 0) + (selectedPetSize ? petQuantity : 0),
          ownerQuantity: selectedSize ? parentQuantity : 0,
          petQuantity: selectedPetSize ? petQuantity : 0,
          type: isMatchingSet ? "combo" : "owner",
          isSubscription: true,
          frequency
        }]
      }
    });
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full gap-2">
          <RefreshCw className="h-4 w-4" />
          Subscribe & Save
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Subscribe & Save</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          <div className="bg-muted/50 p-4 rounded-lg">
            <p className="font-medium">{product.name}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-lg font-bold">₹{discountedTotalPrice.toFixed(2)}</span>
              <span className="text-sm text-muted-foreground line-through">₹{dynamicTotalPrice.toFixed(2)}</span>
              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                {selectedFreq?.discount}
              </span>
            </div>
            <div className="text-xs text-muted-foreground mt-2">
              {selectedSize && <span>Owner Size: {selectedSize} (x{parentQuantity})</span>}
              {selectedSize && selectedPetSize && <span className="mx-2">•</span>}
              {selectedPetSize && <span>Pet Size: {selectedPetSize} (x{petQuantity})</span>}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Delivery Frequency</Label>
            <div className="grid gap-2">
              {frequencies.map((freq) => (
                <button
                  key={freq.value}
                  onClick={() => setFrequency(freq.value)}
                  className={`flex items-center justify-between p-3 border rounded-lg transition-all ${
                    frequency === freq.value 
                      ? "border-primary bg-primary/5" 
                      : "border-border hover:border-foreground"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      frequency === freq.value ? "border-primary bg-primary" : "border-muted-foreground"
                    }`}>
                      {frequency === freq.value && <Check className="h-3 w-3 text-primary-foreground" />}
                    </div>
                    <span>{freq.label}</span>
                  </div>
                  <span className="text-sm text-green-600 font-medium">{freq.discount}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="border-t pt-4">
            <div className="flex justify-between text-sm mb-1">
              <span>Per delivery</span>
              <span>₹{discountedTotalPrice.toFixed(2)}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Cancel anytime. Next delivery will be scheduled based on your frequency.
            </p>
          </div>

          <Button 
            onClick={handleSubscribe} 
            className="w-full" 
          >
            Start Subscription
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
