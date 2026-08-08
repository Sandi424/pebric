import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import {
  ArrowLeft,
  CreditCard,
  Truck,
  ShieldCheck,
  Tag,
  X,
  Check,
  Loader2,
  CheckCircle2,
  XCircle,
  Pencil,
} from "lucide-react";
import { PageLayout } from "@/components/layouts/PageLayout";
import { OptimizedImage } from "@/components/ui/optimized-image";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { useCreateOrder } from "@/hooks/useOrders";
import { useValidateCoupon, Coupon } from "@/hooks/useCoupons";
import {
  PaymentMethodSelector,
  PaymentMethod,
} from "@/components/PaymentMethodSelector";
import { useOrderTotal } from "@/hooks/useOrderTotal";
import { usePaytm, PaytmPaymentResponse } from "@/hooks/usePaytm";
import { usePhonePe } from "@/hooks/usePhonePe";
import { useRazorpay, RazorpayPaymentResponse } from "@/hooks/useRazorpay";
import { toast } from "sonner";
import { SEOHead } from "@/components/SEOHead";
import { usePincodeLookup } from "@/hooks/usePincodeLookup";
import {
  useSavedAddresses,
  useUpdateSavedAddress,
  SavedAddress,
} from "@/hooks/useSavedAddresses";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

// ─── Validation helpers ───────────────────────────────────────────────────────

/** Indian 6-digit postal code: exactly 6 digits, first digit non-zero */
const POSTAL_CODE_RE = /^[1-9][0-9]{5}$/;
/** Phone: Indian mobile numbers, optionally prefixed by +91 or 0 */
const PHONE_RE = /^(?:(?:\+?91)|0)?[6-9]\d{9}$/;
/** Country: letters, spaces, hyphens, at least 2 chars */
const COUNTRY_RE = /^[A-Za-z][A-Za-z\s\-]{1,49}$/;

function validateCheckoutForm(data: CheckoutFormValues): string | null {
  const rawDigits = (data.phone || "").replace(/\D/g, "");
  const phoneDigits = rawDigits.startsWith("91") && rawDigits.length === 12 ? rawDigits.slice(2) : rawDigits;
  if (!/^[6-9]\d{9}$/.test(phoneDigits)) {
    return "Phone number must be a valid 10-digit Indian mobile number.";
  }
  if (!POSTAL_CODE_RE.test(data.postalCode.trim())) {
    return "Postal code must be a valid 6-digit Indian PIN (e.g. 700001).";
  }
  return null;
}


const mapPaytmModeToMethod = (mode?: string | null): PaymentMethod | null => {
  if (!mode) return null;
  const normalized = mode.toUpperCase();
  if (normalized.includes("UPI")) return "upi";
  if (
    normalized.includes("CARD") ||
    normalized.includes("CC") ||
    normalized.includes("DC")
  )
    return "card";
  if (normalized.includes("NB") || normalized.includes("NETBANKING"))
    return "netbanking";
  if (normalized.includes("WALLET")) return "wallet";
  return null;
};

const createCheckoutAttemptId = () =>
  globalThis.crypto?.randomUUID?.() ??
  `checkout-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

type AddressFormValues = {
  fullName: string;
  phone: string;
  address: string;   // Flat, House no., Building
  area: string;      // Area, Street, Sector, Village
  landmark: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
};

type CheckoutFormValues = AddressFormValues & {
  email: string;
};

type CheckoutSnapshotItem = {
  id: string | number;
  quantity: number;
  ownerSize: string | null;
  petSize: string | null;
  image: string;
  name: string;
  price: number;
};

type CheckoutSnapshot = {
  items: CheckoutSnapshotItem[];
  formData: CheckoutFormValues;
  billingData: CheckoutFormValues | null;
  sameAsShipping: boolean;
  coupon?: { id: string; code: string } | null;
  giftWrap: boolean;
  giftMessage: string;
  buyNowItems: CheckoutSnapshotItem[] | null;
  idempotencyKey?: string;
};

function AddressFields({
  prefix,
  values,
  onChange,
  onAutofill,
  onSelectChange,
  onStatusChange,
  required = true,
}: {
  prefix: string;
  values: AddressFormValues;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onAutofill?: (fields: Partial<AddressFormValues>) => void;
  onSelectChange?: (name: string, value: string) => void;
  onStatusChange?: (status: "idle" | "loading" | "valid" | "invalid") => void;
  required?: boolean;
}) {
  const { status, lookupError, fetchPincode, resetStatus } = usePincodeLookup();
  const isLookingUp = status === "loading";

  // Notify parent whenever status changes
  useEffect(() => { onStatusChange?.(status); }, [status, onStatusChange]);

  const phoneDigits = values.phone.replace(/[\s\-().]/g, "");
  const phoneInvalid = values.phone.trim() !== "" && values.phone.trim() !== "+91" && !PHONE_RE.test(phoneDigits);

  const handlePincodeChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(e);
      const pin = e.target.value.trim();
      // Reset status whenever user types
      resetStatus();
      if (pin.length === 6 && POSTAL_CODE_RE.test(pin)) {
        const result = await fetchPincode(pin);
        if (result && onAutofill) {
          onAutofill({ city: result.city, state: result.state, country: result.country });
        }
      }
    },
    [onChange, onAutofill, fetchPincode, resetStatus],
  );

  return (
    <div className="space-y-4">
      {/* Country / Region */}
      <div>
        <Label htmlFor={`${prefix}-country`}>Country / Region{required && <span className="text-destructive"> *</span>}</Label>
        <Input
          id={`${prefix}-country`}
          name="country"
          value="India"
          readOnly
          className="bg-muted/50 text-muted-foreground"
        />
      </div>

      {/* Full Name */}
      <div>
        <Label htmlFor={`${prefix}-fullName`}>Full name (First and Last name){required && <span className="text-destructive"> *</span>}</Label>
        <Input
          id={`${prefix}-fullName`}
          name="fullName"
          value={values.fullName}
          onChange={onChange}
          required={required}
          placeholder=""
        />
      </div>

      {/* Mobile */}
      <div>
        <Label htmlFor={`${prefix}-phone`}>Mobile number{required && <span className="text-destructive"> *</span>}</Label>
        <Input
          id={`${prefix}-phone`}
          name="phone"
          type="tel"
          value={values.phone}
          onChange={onChange}
          required={required}
          className={phoneInvalid ? "border-destructive focus-visible:ring-destructive" : ""}
        />
        {phoneInvalid
          ? <p className="mt-1 text-xs text-destructive">Enter a valid 10-digit Indian mobile number.</p>
          : <p className="mt-1 text-xs text-muted-foreground">May be used to assist delivery</p>
        }
      </div>

      {/* Pincode */}
      <div>
        <Label htmlFor={`${prefix}-postalCode`}>Pincode{required && <span className="text-destructive"> *</span>}</Label>
        <div className="relative">
          <Input
            id={`${prefix}-postalCode`}
            name="postalCode"
            value={values.postalCode}
            onChange={handlePincodeChange}
            required={required}
            maxLength={6}
            inputMode="numeric"
            placeholder="6 digits [0-9] PIN code"
            className={[
              "pr-9",
              status === "invalid" || (values.postalCode.length === 6 && !POSTAL_CODE_RE.test(values.postalCode)) ? "border-destructive focus-visible:ring-destructive" : "",
            ].join(" ")}
          />
          {isLookingUp && (
            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
          {(status === "invalid" || (values.postalCode.length === 6 && !POSTAL_CODE_RE.test(values.postalCode))) && !isLookingUp && (
            <XCircle className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-destructive" />
          )}
        </div>
        {isLookingUp && (
          <p className="mt-1 text-xs text-muted-foreground">Verifying PIN code...</p>
        )}
        {values.postalCode.length === 6 && !POSTAL_CODE_RE.test(values.postalCode) && (
          <p className="mt-1 text-xs text-destructive">Enter a valid 6-digit PIN (e.g. 700001).</p>
        )}
        {status === "invalid" && !isLookingUp && values.postalCode.length === 6 && POSTAL_CODE_RE.test(values.postalCode) && (
          <p className="mt-1 text-xs text-destructive">{lookupError ?? "Invalid PIN code."}</p>
        )}
        {values.postalCode.length > 0 && values.postalCode.length < 6 && (
          <p className="mt-1 text-xs text-muted-foreground">Enter all 6 digits</p>
        )}
      </div>

      {/* Flat / House */}
      <div>
        <Label htmlFor={`${prefix}-address`}>Flat, House no., Building, Company, Apartment{required && <span className="text-destructive"> *</span>}</Label>
        <Input
          id={`${prefix}-address`}
          name="address"
          value={values.address}
          onChange={onChange}
          required={required}
        />
      </div>

      {/* Area / Street */}
      <div>
        <Label htmlFor={`${prefix}-area`}>Area, Street, Sector, Village</Label>
        <Input
          id={`${prefix}-area`}
          name="area"
          value={values.area}
          onChange={onChange}
        />
      </div>

      {/* Landmark */}
      <div>
        <Label htmlFor={`${prefix}-landmark`}>Landmark</Label>
        <Input
          id={`${prefix}-landmark`}
          name="landmark"
          value={values.landmark}
          onChange={onChange}
          placeholder="E.g. near apollo hospital"
        />
      </div>

      {/* Town / City  +  State */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor={`${prefix}-city`}>Town / City{required && <span className="text-destructive"> *</span>}</Label>
          <Input
            id={`${prefix}-city`}
            name="city"
            value={values.city}
            onChange={onChange}
            required={required}
            readOnly={status === "valid" || (values.postalCode.length === 6 && !!values.city)}
            className={(status === "valid" || (values.postalCode.length === 6 && !!values.city)) ? "bg-muted/50 text-muted-foreground cursor-not-allowed" : ""}
            placeholder={isLookingUp ? "Fetching..." : ""}
          />
        </div>
        <div>
          <Label htmlFor={`${prefix}-state`}>State{required && <span className="text-destructive"> *</span>}</Label>
          <Input
            id={`${prefix}-state`}
            name="state"
            value={values.state}
            onChange={onChange}
            required={required}
            readOnly={status === "valid" || (values.postalCode.length === 6 && !!values.state)}
            className={(status === "valid" || (values.postalCode.length === 6 && !!values.state)) ? "bg-muted/50 text-muted-foreground cursor-not-allowed" : ""}
            placeholder={isLookingUp ? "Fetching..." : ""}
          />
        </div>
      </div>
    </div>
  );
}

export default function Checkout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { cartItems, cartTotal, clearCart } = useCart();
  const { user, profile } = useAuth();
  const createOrder = useCreateOrder();

  const buyNowItems = location.state?.buyNowItems;

  // Use buyNowItems if present, otherwise use cartItems
  const checkoutItems = useMemo(() => {
    return buyNowItems && buyNowItems.length > 0 ? buyNowItems : cartItems;
  }, [buyNowItems, cartItems]);

  const activeTotal = useMemo(() => {
    if (buyNowItems && buyNowItems.length > 0) {
      return buyNowItems.reduce(
        (acc: number, item: any) => {
          const isMatchingSet = item.ownerSize !== "N/A" && item.petSize !== "N/A";
          if (isMatchingSet) {
            const halfPrice = Math.round(item.price * 0.5);
            return acc + (item.ownerSize !== "N/A" ? item.ownerQuantity * halfPrice : 0) +
                         (item.petSize !== "N/A" ? item.petQuantity * halfPrice : 0);
          }
          return acc + item.price * item.quantity;
        },
        0,
      );
    }
    return cartTotal;
  }, [buyNowItems, cartTotal]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [shippingPincodeStatus, setShippingPincodeStatus] = useState<"idle"|"loading"|"valid"|"invalid">("idle");
  const [billingPincodeStatus, setBillingPincodeStatus] = useState<"idle"|"loading"|"valid"|"invalid">("idle");
  const emptyAddress = (): CheckoutFormValues => ({
    email: user?.email || "",
    fullName: profile?.full_name || "",
    phone: profile?.phone || "+91 ",
    address: profile?.address || "",
    area: "",
    landmark: "",
    city: profile?.city || "",
    state: "",
    postalCode: profile?.postal_code || "",
    country: profile?.country || "India",
  });
  const [formData, setFormData] = useState<CheckoutFormValues>(emptyAddress);
  const [billingData, setBillingData] = useState<CheckoutFormValues>(emptyAddress);
  const [sameAsShipping, setSameAsShipping] = useState(true);

  const { data: savedAddresses = [] } = useSavedAddresses();
  const [selectedAddressId, setSelectedAddressId] = useState<string>("new");
  const [hasInitializedAddress, setHasInitializedAddress] = useState(false);
  const [editingAddress, setEditingAddress] = useState<SavedAddress | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  useEffect(() => {
    if (savedAddresses.length > 0 && !hasInitializedAddress) {
      const defaultAddr = savedAddresses.find((a) => a.is_default) || savedAddresses[0];
      setSelectedAddressId(defaultAddr.id);
      setHasInitializedAddress(true);
      
      const newFormData = {
        ...emptyAddress(),
        fullName: defaultAddr.full_name,
        phone: defaultAddr.phone || "+91 ",
        address: defaultAddr.address_line1,
        area: defaultAddr.address_line2 || "",
        city: defaultAddr.city,
        state: defaultAddr.state || "",
        postalCode: defaultAddr.postal_code,
        country: defaultAddr.country,
      };
      setFormData(newFormData);
    }
  }, [savedAddresses, hasInitializedAddress, user]);

  const handleAddressSelect = (id: string) => {
    setSelectedAddressId(id);
    if (id === "new") {
       setFormData(emptyAddress());
    } else {
       const addr = savedAddresses.find(a => a.id === id);
       if (addr) {
         setFormData(prev => ({
          ...prev,
          fullName: addr.full_name,
          phone: addr.phone || "+91 ",
          address: addr.address_line1,
          area: addr.address_line2 || "",
          city: addr.city,
          state: addr.state || "",
          postalCode: addr.postal_code,
          country: addr.country,
         }));
       }
    }
  };

  useEffect(() => {
    if (profile) {
      setFormData((prev) => ({
        ...prev,
        email: prev.email || user?.email || "",
        fullName: prev.fullName || profile.full_name || "",
        phone: prev.phone || profile.phone || "+91 ",
        address: prev.address || profile.address || "",
        city: prev.city || profile.city || "",
        postalCode: prev.postalCode || profile.postal_code || "",
        country: prev.country || profile.country || "India",
      }));
      setBillingData((prev) => ({
        ...prev,
        email: prev.email || user?.email || "",
        fullName: prev.fullName || profile.full_name || "",
        phone: prev.phone || profile.phone || "+91 ",
        address: prev.address || profile.address || "",
        city: prev.city || profile.city || "",
        postalCode: prev.postalCode || profile.postal_code || "",
        country: prev.country || profile.country || "India",
      }));
    }
  }, [profile, user?.email]);

  useEffect(() => {
    if (!sameAsShipping) return;
    setBillingData({ ...formData });
  }, [formData, sameAsShipping]);

  // Coupon state
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [isValidating, setIsValidating] = useState(false);
  const validateCoupon = useValidateCoupon();
  const {
    openCheckout: openPaytmCheckout,
    verifyPayment: verifyPaytmPayment,
    isLoading: isPaytmLoading,
  } = usePaytm();
  const {
    openCheckout: openPhonePeCheckout,
    verifyPayment: verifyPhonePePayment,
    isLoading: isPhonePeLoading,
  } = usePhonePe();
  const {
    openCheckout: openRazorpayCheckout,
    isLoading: isRazorpayLoading,
  } = useRazorpay();

  // Payment method state
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("phonepe");
  const codAvailable = true;
  const codFee = paymentMethod === "cod" ? 11 : 0;

  // Gift wrap state
  const [giftWrap, setGiftWrap] = useState(false);
  const [giftMessage, setGiftMessage] = useState("");
  const giftWrapPrice = 5;

  // Use OrderTotal domain object for pricing calculations
  const giftWrapCost = giftWrap ? giftWrapPrice : 0;
  const {
    shippingCost,
    tax,
    codFee: appliedCodFee,
    total,
  } = useOrderTotal(activeTotal, couponDiscount, giftWrapCost, codFee);

  const handleApplyCoupon = async (e?: React.SyntheticEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!couponCode.trim()) return;

    setIsValidating(true);
    const result = await validateCoupon.mutateAsync({
      code: couponCode,
      orderAmount: activeTotal,
    });
    setIsValidating(false);

    if (result.valid && result.coupon && result.discount) {
      setAppliedCoupon(result.coupon);
      setCouponDiscount(result.discount);
      toast.success("Coupon applied!", {
        description: `You saved ₹${result.discount.toFixed(2)}`,
      });
    } else {
      toast.error(result.message || "Invalid coupon");
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponDiscount(0);
    setCouponCode("");
  };

  const handleShippingInputChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleBillingInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBillingData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSameAsShippingChange = (checked: boolean | "indeterminate") => {
    setSameAsShipping(checked === true);
    if (checked === true) setBillingData({ ...formData });
  };

  const buildAddressPayload = (
    values: AddressFormValues,
    extras?: { email?: string },
  ) => ({
    full_name: values.fullName,
    firstName: values.fullName.split(" ")[0],
    lastName: values.fullName.split(" ").slice(1).join(" "),
    address: [values.address, values.area, values.landmark].filter(Boolean).join(", "),
    city: values.city,
    state: values.state,
    postal_code: values.postalCode,
    postalCode: values.postalCode,
    country: values.country,
    phone: values.phone,
    email: extras?.email,
  });

  const buildShippingAddress = () =>
    buildAddressPayload(formData, { email: formData.email });

  const buildBillingAddress = () =>
    sameAsShipping
      ? buildShippingAddress()
      : buildAddressPayload(billingData, { email: billingData.email });

  const buildOrderItems = () => {
    const items: {
      productId: string;
      productName?: string;
      productImage?: string;
      price?: number;
      quantity: number;
      size: string | null;
      petSize: string | null;
    }[] = [];

    checkoutItems.forEach((item) => {
      const itemName = (item as any).name || (item as any).productName || "Product Item";
      const itemImg = (item as any).image || (item as any).image_url || (item as any).productImage || null;
      const isMatchingSet = item.ownerSize !== "N/A" && item.petSize !== "N/A";
      const halfPrice = Math.round(((item as any).price || 0) * 0.5);

      if (isMatchingSet) {
        if (item.ownerQuantity > 0) {
          items.push({
            productId: item.id.toString(),
            productName: `${itemName} (Human)`,
            productImage: itemImg,
            price: halfPrice,
            quantity: item.ownerQuantity,
            size: item.ownerSize,
            petSize: "N/A",
          });
        }
        if (item.petQuantity > 0) {
          items.push({
            productId: item.id.toString(),
            productName: `${itemName} (Pet)`,
            productImage: itemImg,
            price: halfPrice,
            quantity: item.petQuantity,
            size: "N/A",
            petSize: item.petSize,
          });
        }
      } else {
        items.push({
          productId: item.id.toString(),
          productName: itemName,
          productImage: itemImg,
          price: (item as any).price || 0,
          quantity: item.quantity,
          size: item.ownerSize,
          petSize: item.petSize,
        });
      }
    });

    return items;
  };

  const finalizeOrder = async (
    options?: {
      items?: ReturnType<typeof buildOrderItems>;
      shippingAddress?: ReturnType<typeof buildShippingAddress>;
      billingAddress?: ReturnType<typeof buildBillingAddress>;
      transactionId?: string;
      paymentMethod?: string;
      paymentStatus?: string;
      giftWrap?: boolean;
      giftMessage?: string;
      clearUserCart?: boolean;
      couponId?: string;
      idempotencyKey?: string;
    },
  ) => {
    const order = await createOrder.mutateAsync({
      items: options?.items || buildOrderItems(),
      paymentMethod: options?.paymentMethod || paymentMethod,
      paymentStatus: options?.paymentStatus,
      transactionId: options?.transactionId,
      shippingAddress: options?.shippingAddress || buildShippingAddress(),
      billingAddress: options?.billingAddress || buildBillingAddress(),
      giftWrap: options?.giftWrap ?? giftWrap,
      giftMessage: options?.giftMessage ?? giftMessage,
      clearUserCart:
        options?.clearUserCart ?? !(buyNowItems && buyNowItems.length > 0),
      couponId: options?.couponId || appliedCoupon?.id,
      idempotencyKey: options?.idempotencyKey,
    });

    if (
      order &&
      (options?.clearUserCart ?? !(buyNowItems && buyNowItems.length > 0))
    ) {
      clearCart();
    }

    return order;
  };

  // Handle returning from PhonePe payment
  // The effect depends on `user` so it fires once the auth session is loaded.
  // hasHandledCallback ref ensures it only acts once even though user may re-trigger the effect.
  const hasHandledCallback = useRef(false);
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const isPhonePeCallback = urlParams.get("phonepe_callback") === "true";
    if (!isPhonePeCallback || hasHandledCallback.current) return;

    // Wait until the user auth session is loaded before proceeding
    if (!user) return;

    hasHandledCallback.current = true;
    // Clean up URL immediately so any re-render doesn't re-trigger
    window.history.replaceState({}, document.title, window.location.pathname);

    const handlePhonePeCallback = async () => {
      const transactionId =
        urlParams.get("transactionId") ||
        sessionStorage.getItem("phonepe_merchant_transaction_id");

      if (!transactionId) {
        toast.error("Payment verification failed", {
          description: "Missing transaction reference.",
        });
        return;
      }

      setIsSubmitting(true);
      try {
        const verification = await verifyPhonePePayment(transactionId);

        if (!verification.verified) {
          toast.error("Payment not successful", {
            description: `Status: ${verification.status}. If amount was deducted, it will be refunded.`,
          });
          setIsSubmitting(false);
          return;
        }

        // Restore checkout snapshot saved before redirect (cart context not loaded yet)
        const snapshotJson = sessionStorage.getItem(
          "phonepe_checkout_snapshot",
        );
        if (!snapshotJson) {
          toast.error("Could not restore order data. Please contact support.", {
            description: `Transaction ID: ${transactionId}`,
          });
          setIsSubmitting(false);
          return;
        }

        let snapshot: CheckoutSnapshot;
        try {
          snapshot = JSON.parse(snapshotJson) as CheckoutSnapshot;
        } catch (error) {
          console.error("Failed to parse PhonePe checkout snapshot:", error);
          toast.error("Could not restore your checkout details.", {
            description: `Transaction ID: ${transactionId}`,
          });
          sessionStorage.removeItem("phonepe_checkout_snapshot");
          setIsSubmitting(false);
          return;
        }

        const snapshotItems = snapshot.items;

        if (!snapshotItems || snapshotItems.length === 0) {
          toast.error("Your cart is empty, cannot create order post-payment.");
          setIsSubmitting(false);
          return;
        }

        // Build order items from snapshot (not from live cart context)
        const orderItems = snapshotItems.map((item) => ({
          productId: item.id.toString(),
          quantity: item.quantity,
          size: item.ownerSize,
          petSize: item.petSize,
        }));

        const fd = snapshot.formData;
        const shippingAddress = {
          full_name: fd.fullName || `${(fd as any).firstName ?? ""} ${(fd as any).lastName ?? ""}`.trim(),
          firstName: fd.fullName?.split(" ")[0] ?? (fd as any).firstName ?? "",
          lastName: fd.fullName?.split(" ").slice(1).join(" ") ?? (fd as any).lastName ?? "",
          address: [fd.address, fd.area, fd.landmark].filter(Boolean).join(", "),
          city: fd.city,
          state: fd.state,
          postal_code: fd.postalCode,
          postalCode: fd.postalCode,
          country: fd.country,
          phone: fd.phone,
          email: fd.email,
        };
        const bd = snapshot.billingData;
        const billingAddress =
          snapshot.sameAsShipping !== false || !bd
            ? shippingAddress
            : {
                full_name: bd.fullName || `${(bd as any).firstName ?? ""} ${(bd as any).lastName ?? ""}`.trim(),
                email: bd.email,
                phone: bd.phone,
                firstName: bd.fullName?.split(" ")[0] ?? (bd as any).firstName ?? "",
                lastName: bd.fullName?.split(" ").slice(1).join(" ") ?? (bd as any).lastName ?? "",
                address: [bd.address, bd.area, bd.landmark].filter(Boolean).join(", "),
                city: bd.city,
                state: bd.state,
                postal_code: bd.postalCode,
                postalCode: bd.postalCode,
                country: bd.country,
              };

        const resolvedMethod = verification.paymentMode || "phonepe";

        await finalizeOrder({
          items: orderItems,
          paymentMethod: resolvedMethod,
          paymentStatus: "completed",
          transactionId,
          shippingAddress,
          billingAddress,
          giftWrap: snapshot.giftWrap,
          giftMessage: snapshot.giftMessage,
          clearUserCart: !(
            snapshot.buyNowItems && snapshot.buyNowItems.length > 0
          ),
          couponId: snapshot.coupon?.id || undefined,
          idempotencyKey: snapshot.idempotencyKey,
        });

        // Clean up sessionStorage
        sessionStorage.removeItem("phonepe_merchant_transaction_id");
        sessionStorage.removeItem("phonepe_checkout_snapshot");

        toast.success("Payment successful! Order placed.", {
          description: `Transaction ID: ${transactionId}`,
        });
        navigate("/orders");
      } catch (error: unknown) {
        console.error("PhonePe callback error:", error);
        const errMsg = error instanceof Error ? error.message : "Unknown error";
        toast.error("Failed to complete payment", {
          description:
            errMsg.length < 120
              ? errMsg
              : "Please contact support with your transaction ID.",
        });
        setIsSubmitting(false);
      }
    };

    handlePhonePeCallback();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]); // Depends on user — waits for auth session to load before creating order

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast.error("Please sign in to complete your order");
      navigate("/login");
      return;
    }

    if (checkoutItems.length === 0) {
      toast.error("Your cart is empty");
      return;
    }

    // Validate shipping address fields
    const shippingError = validateCheckoutForm(formData);
    if (shippingError) {
      toast.error("Invalid shipping details", { description: shippingError });
      return;
    }
    if (shippingPincodeStatus === "invalid") {
      toast.error("Invalid shipping PIN code", {
        description: "The PIN code you entered was not found. Please check and try again.",
      });
      return;
    }

    // Validate billing address if different from shipping
    if (!sameAsShipping) {
      const billingError = validateCheckoutForm(billingData);
      if (billingError) {
        toast.error("Invalid billing details", { description: billingError });
        return;
      }
      if (billingPincodeStatus === "invalid") {
        toast.error("Invalid billing PIN code", {
          description: "The billing PIN code was not found. Please check and try again.",
        });
        return;
      }
    }

    setIsSubmitting(true);

    // COD flow — direct order creation
    if (paymentMethod === "cod") {
      try {
        await finalizeOrder({ idempotencyKey: createCheckoutAttemptId() });
        toast.success("Order placed successfully!", {
          description: "Pay when you receive your order.",
        });
        navigate("/orders");
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // Online Pay (Razorpay) flow — no server-side edge function needed
    if (paymentMethod === "phonepe" || paymentMethod === "upi" || paymentMethod === "card" || paymentMethod === "netbanking") {
      const checkoutAttemptId = createCheckoutAttemptId();

      openRazorpayCheckout({
        amount: total,
        customerEmail: formData.email,
        customerPhone: formData.phone,
        customerName: formData.fullName,
        onSuccess: async (response: RazorpayPaymentResponse) => {
          try {
            const transactionId = response.razorpay_payment_id;

            await finalizeOrder({
              transactionId,
              paymentMethod: "upi",
              paymentStatus: "completed",
              idempotencyKey: checkoutAttemptId,
            });

            toast.success("Payment successful! Order placed.", {
              description: transactionId
                ? `Transaction ID: ${transactionId}`
                : "Paid online",
            });
            navigate("/orders");
          } catch (error) {
            toast.error("Failed to save order after payment", {
              description:
                "Payment was successful. Please contact support with your transaction ID.",
            });
          } finally {
            setIsSubmitting(false);
          }
        },
        onFailure: (error: string) => {
          toast.error("Payment failed", {
            description: error,
          });
          setIsSubmitting(false);
        },
      });
      return;
    }

    // Fallback Paytm checkout (if somehow another payment method is selected)
    const checkoutAttemptId = createCheckoutAttemptId();
    openPaytmCheckout({
      amount: total,
      customerEmail: formData.email,
      customerPhone: formData.phone,
      customerId: user.id,
      onSuccess: async (response: PaytmPaymentResponse) => {
        try {
          const orderId = response.ORDERID;
          if (!orderId) {
            toast.error("Payment verification failed", {
              description: "Order reference missing from gateway response.",
            });
            setIsSubmitting(false);
            return;
          }

          const verification = await verifyPaytmPayment(orderId);
          if (!verification.verified) {
            toast.error("Payment verification failed", {
              description: "Please contact support if amount was deducted.",
            });
            setIsSubmitting(false);
            return;
          }

          const transactionId = verification.transactionId || response.TXNID;
          const resolvedMethod =
            mapPaytmModeToMethod(
              verification.paymentMode || response.PAYMENTMODE,
            ) || paymentMethod;

          await finalizeOrder({
            transactionId: transactionId || undefined,
            paymentMethod: resolvedMethod,
            paymentStatus: "completed",
            idempotencyKey: checkoutAttemptId,
          });
          toast.success("Payment successful! Order placed.", {
            description: transactionId
              ? `Transaction ID: ${transactionId}`
              : "Paid via Paytm",
          });
          navigate("/orders");
        } catch (error) {
          toast.error("Failed to save order after payment", {
            description:
              "Payment was successful. Please contact support with your transaction ID.",
          });
        } finally {
          setIsSubmitting(false);
        }
      },
      onFailure: (error: string) => {
        toast.error("Payment failed", {
          description: error,
        });
        setIsSubmitting(false);
      },
    });
  };

  if (checkoutItems.length === 0) {
    return (
      <PageLayout showNewsletter={false}>
        <div className="container mx-auto px-6 py-32 text-center">
          <h1 className="mb-4 font-display text-4xl font-medium">
            Your Cart is Empty
          </h1>
          <p className="mb-8 font-body text-muted-foreground">
            Add some items to your cart before checking out.
          </p>
          <Link to="/shop">
            <Button variant="hero">Continue Shopping</Button>
          </Link>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout showNewsletter={false}>
      <SEOHead
        title="Checkout"
        description="Complete your Pebric order securely."
        noindex={true}
      />
      <div className="container mx-auto px-6 py-6 md:py-8">
        <Link
          to="/cart"
          className="mb-8 inline-flex items-center gap-2 font-body text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Cart
        </Link>

        <h1 className="mb-12 font-display text-4xl font-medium md:text-5xl">
          Checkout
        </h1>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-12 lg:grid-cols-2">
            {/* Left Column - Form */}
            <div className="space-y-8">
              {/* Shipping Address */}
              <div>
                <h2 className="mb-6 font-display text-xl font-medium">
                  Shipping Address
                </h2>
                {/* Email */}
                <div className="mb-4">
                  <Label htmlFor="shipping-email">Email address</Label>
                  <Input
                    id="shipping-email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleShippingInputChange}
                    required
                  />
                </div>
                {user && savedAddresses.length > 0 && (
                  <div className="mb-6">
                    <Label className="mb-3 block text-sm font-medium text-foreground">Select delivery address</Label>
                    <RadioGroup value={selectedAddressId} onValueChange={handleAddressSelect} className="gap-3">
                      {savedAddresses.map((addr) => (
                        <div
                          key={addr.id}
                          className={`relative rounded-xl border p-4 ${
                            selectedAddressId === addr.id ? "border-primary bg-primary/5" : "border-border"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3 flex-1">
                              <RadioGroupItem value={addr.id} id={addr.id} className="mt-1" />
                              <Label htmlFor={addr.id} className="flex-1 cursor-pointer">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-foreground">{addr.label}</span>
                                  {addr.is_default && (
                                    <span className="rounded bg-primary/10 px-2 py-0.5 text-xs text-primary">
                                      Default
                                    </span>
                                  )}
                                </div>
                                <p className="mt-1 text-sm font-medium text-foreground">{addr.full_name}</p>
                                <p className="text-sm text-muted-foreground">{addr.address_line1}{addr.address_line2 ? `, ${addr.address_line2}` : ""}</p>
                                <p className="text-sm text-muted-foreground">{addr.city}, {addr.state} {addr.postal_code}</p>
                                {addr.phone && <p className="mt-1 text-sm text-muted-foreground">Phone: {addr.phone}</p>}
                              </Label>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 px-2.5 text-xs flex items-center gap-1.5 text-foreground hover:bg-muted"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setEditingAddress(addr);
                                setIsEditModalOpen(true);
                              }}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Edit
                            </Button>
                          </div>
                        </div>
                      ))}
                      <div className={`relative rounded-xl border p-4 ${
                            selectedAddressId === "new" ? "border-primary bg-primary/5" : "border-border"
                          }`}>
                        <div className="flex items-center gap-3">
                          <RadioGroupItem value="new" id="new-address" />
                          <Label htmlFor="new-address" className="flex-1 cursor-pointer font-medium text-foreground">
                            Add a new address
                          </Label>
                        </div>
                      </div>
                    </RadioGroup>
                  </div>
                )}

                {(!user || savedAddresses.length === 0 || selectedAddressId === "new") && (
                  <div className="space-y-6">
                    {user && savedAddresses.length > 0 && (
                      <h3 className="font-medium text-foreground">Enter new address details</h3>
                    )}
                    <AddressFields
                      prefix="shipping"
                      values={formData}
                      onChange={handleShippingInputChange}
                      onAutofill={(fields) =>
                        setFormData((prev) => ({ ...prev, ...fields }))
                      }
                      onSelectChange={(name, value) =>
                        setFormData((prev) => ({ ...prev, [name]: value }))
                      }
                      onStatusChange={setShippingPincodeStatus}
                    />
                  </div>
                )}
              </div>

              {/* Billing Address */}
              <div>
                <div className="mb-6 flex items-center justify-between gap-4">
                  <h2 className="font-display text-xl font-medium">
                    Billing Address
                  </h2>
                  <label className="flex items-center gap-3 text-sm text-muted-foreground">
                    <Checkbox
                      checked={sameAsShipping}
                      onCheckedChange={handleSameAsShippingChange}
                    />
                    <span>Same as shipping address</span>
                  </label>
                </div>

                {!sameAsShipping && (
                  <div className="space-y-6">
                    {/* Billing email */}
                    <div>
                      <Label htmlFor="billing-email">Email address</Label>
                      <Input
                        id="billing-email"
                        name="email"
                        type="email"
                        value={billingData.email}
                        onChange={handleBillingInputChange}
                        required
                      />
                    </div>
                    <AddressFields
                      prefix="billing"
                      values={billingData}
                      onChange={handleBillingInputChange}
                      onAutofill={(fields) =>
                        setBillingData((prev) => ({ ...prev, ...fields }))
                      }
                      onSelectChange={(name, value) =>
                        setBillingData((prev) => ({ ...prev, [name]: value }))
                      }
                      onStatusChange={setBillingPincodeStatus}
                    />
                  </div>
                )}
                {sameAsShipping && (
                  <div className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-3">
                    <p className="font-body text-sm text-muted-foreground">
                      Your billing address will match your shipping address.
                    </p>
                  </div>
                )}
              </div>

              {/* Payment Method */}
              <div className="border-t border-border pt-8">
                <PaymentMethodSelector
                  selected={paymentMethod}
                  onSelect={setPaymentMethod}
                  codAvailable={codAvailable}
                  total={total}
                />
              </div>

              {/* Trust Badges */}
              <div className="grid grid-cols-3 gap-4 border-t border-border pt-8">
                <div className="text-center">
                  <Truck className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
                  <p className="font-body text-xs text-muted-foreground">
                    Free Shipping ₹100+
                  </p>
                </div>
                <div className="text-center">
                  <ShieldCheck className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
                  <p className="font-body text-xs text-muted-foreground">
                    Secure Checkout
                  </p>
                </div>
                <div className="text-center">
                  <CreditCard className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
                  <p className="font-body text-xs text-muted-foreground">
                    Safe Payment
                  </p>
                </div>
              </div>
            </div>

            {/* Right Column - Order Summary */}
            <div>
              <div className="sticky top-8 bg-muted p-6">
                <h2 className="mb-6 font-display text-xl font-medium">
                  Order Summary
                </h2>

                {/* Cart Items */}
                <div className="mb-6 space-y-4 border-b border-border pb-6">
                  {checkoutItems.map((item) => {
                    const isMatchingSet = item.ownerSize !== "N/A" && item.petSize !== "N/A";
                    const halfPrice = Math.round(item.price * 0.5);
                    const lineTotal = isMatchingSet
                      ? (item.ownerSize !== "N/A" ? item.ownerQuantity * halfPrice : 0) +
                        (item.petSize !== "N/A" ? item.petQuantity * halfPrice : 0)
                      : item.price * item.quantity;

                    return (
                      <div
                        key={`${item.id}-${item.ownerSize}-${item.petSize}`}
                        className="flex gap-4"
                      >
                        <div className="h-20 w-16 flex-shrink-0 overflow-hidden bg-background">
                          <OptimizedImage
                            src={item.image}
                            alt={item.name}
                            className="h-full w-full object-cover"
                            sizes="80px"
                          />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-body text-sm font-medium line-clamp-2">
                            {item.name}
                          </h3>
                          <div className="font-body text-xs text-muted-foreground space-y-0.5">
                            {item.ownerSize !== "N/A" && (
                              <p>👤 Owner: Size {item.ownerSize} (Qty: {item.ownerQuantity})</p>
                            )}
                            {item.petSize !== "N/A" && (
                              <p>🐾 Pet: Size {item.petSize} (Qty: {item.petQuantity})</p>
                            )}
                          </div>
                        </div>
                        <p className="font-body text-sm font-medium">
                          ₹{lineTotal}
                        </p>
                      </div>
                    );
                  })}
                </div>

                {/* Coupon Code */}
                <div className="mb-6 border-b border-border pb-6">
                  <label className="mb-2 block font-body text-sm font-medium">
                    <Tag className="mr-1 inline h-4 w-4" />
                    Discount Code
                  </label>
                  {appliedCoupon ? (
                    <div className="flex items-center justify-between rounded-md bg-green-50 p-3 dark:bg-green-900/20">
                      <div className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-600" />
                        <span className="font-body text-sm font-medium text-green-600">
                          {appliedCoupon.code}
                        </span>
                        <span className="font-body text-xs text-green-600/80">
                          (-₹{couponDiscount.toFixed(2)})
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleRemoveCoupon}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Input
                        value={couponCode}
                        onChange={(e) =>
                          setCouponCode(e.target.value.toUpperCase())
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            e.stopPropagation();
                            handleApplyCoupon(e);
                          }
                        }}
                        placeholder="Enter code"
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={(e) => handleApplyCoupon(e)}
                        disabled={isValidating || !couponCode.trim()}
                      >
                        {isValidating ? "..." : "Apply"}
                      </Button>
                    </div>
                  )}
                </div>

                {/* Totals */}
                <div className="space-y-3 border-b border-border pb-6">
                  <div className="flex justify-between font-body text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>₹{activeTotal.toFixed(2)}</span>
                  </div>
                  {couponDiscount > 0 && (
                    <div className="flex justify-between font-body text-sm text-green-600">
                      <span>Discount</span>
                      <span>-₹{couponDiscount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-body text-sm">
                    <span className="text-muted-foreground">Shipping</span>
                    <span>
                      {shippingCost === 0
                        ? "Free"
                        : `₹${shippingCost.toFixed(2)}`}
                    </span>
                  </div>
                  <div className="flex justify-between font-body text-sm">
                    <span className="text-muted-foreground">Tax (8%)</span>
                    <span>₹{tax.toFixed(2)}</span>
                  </div>
                  {appliedCodFee > 0 && (
                    <div className="flex justify-between font-body text-sm">
                      <span className="text-muted-foreground">COD Fee</span>
                      <span>₹{appliedCodFee.toFixed(2)}</span>
                    </div>
                  )}
                </div>

                <div className="flex justify-between py-6">
                  <span className="font-display text-lg font-medium">
                    Total
                  </span>
                  <span className="font-display text-lg font-medium">
                    ₹{total.toFixed(2)}
                  </span>
                </div>

                <Button
                  type="submit"
                  variant="hero"
                  className="w-full"
                  disabled={
                    isSubmitting || isPaytmLoading || isPhonePeLoading
                  }
                >
                  {isSubmitting || isPaytmLoading || isPhonePeLoading
                    ? "Processing..."
                    : user
                      ? "Place Order"
                      : "Sign in to Checkout"}
                </Button>

                {!user && (
                  <p className="mt-4 text-center font-body text-xs text-muted-foreground">
                    <Link
                      to="/login"
                      className="underline hover:text-foreground"
                    >
                      Sign in
                    </Link>{" "}
                    or{" "}
                    <Link
                      to="/signup"
                      className="underline hover:text-foreground"
                    >
                      create an account
                    </Link>{" "}
                    to checkout
                  </p>
                )}

                <p className="mt-4 text-center font-body text-xs text-muted-foreground">
                  By placing your order, you agree to our Terms of Service and
                  Privacy Policy.
                </p>
              </div>
            </div>
          </div>
        </form>
      </div>

      <EditCheckoutAddressModal
        address={editingAddress}
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSaveSuccess={(updated) => {
          if (selectedAddressId === updated.id) {
            setFormData((prev) => ({
              ...prev,
              fullName: updated.full_name,
              phone: updated.phone || "+91 ",
              address: updated.address_line1,
              area: updated.address_line2 || "",
              city: updated.city,
              state: updated.state || "",
              postalCode: updated.postal_code,
              country: updated.country || "India",
            }));
          }
        }}
      />
    </PageLayout>
  );
}

function EditCheckoutAddressModal({
  address,
  isOpen,
  onClose,
  onSaveSuccess,
}: {
  address: SavedAddress | null;
  isOpen: boolean;
  onClose: () => void;
  onSaveSuccess: (updated: SavedAddress) => void;
}) {
  const updateAddress = useUpdateSavedAddress();
  const { status, fetchPincode, resetStatus } = usePincodeLookup();

  const [form, setForm] = useState({
    label: "",
    full_name: "",
    phone: "",
    address_line1: "",
    address_line2: "",
    postal_code: "",
    city: "",
    state: "",
    country: "India",
  });

  useEffect(() => {
    if (address) {
      setForm({
        label: address.label || "Home",
        full_name: address.full_name || "",
        phone: address.phone || "+91 ",
        address_line1: address.address_line1 || "",
        address_line2: address.address_line2 || "",
        postal_code: address.postal_code || "",
        city: address.city || "",
        state: address.state || "",
        country: address.country || "India",
      });
      resetStatus();
    }
  }, [address, resetStatus]);

  if (!address) return null;

  const handlePincodeChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const pin = e.target.value.trim();
    setForm((prev) => ({ ...prev, postal_code: pin }));
    resetStatus();
    if (pin.length === 6 && /^[1-9][0-9]{5}$/.test(pin)) {
      const result = await fetchPincode(pin);
      if (result) {
        setForm((prev) => ({
          ...prev,
          city: result.city,
          state: result.state,
          country: result.country,
        }));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name.trim() || !form.phone.trim() || !form.address_line1.trim() || !form.postal_code.trim()) {
      toast.error("Please fill in all required fields.");
      return;
    }

    try {
      const payload = {
        id: address.id,
        label: form.label,
        full_name: form.full_name,
        phone: form.phone,
        address_line1: form.address_line1,
        address_line2: form.address_line2 || null,
        postal_code: form.postal_code,
        city: form.city,
        state: form.state || null,
        country: form.country || "India",
      };

      await updateAddress.mutateAsync(payload);
      onSaveSuccess({ ...address, ...payload } as SavedAddress);
      toast.success("Address updated successfully!");
      onClose();
    } catch (err) {
      console.error("Failed to update address:", err);
      toast.error("Failed to update address");
    }
  };

  const isSaving = updateAddress.isPending;

  const isPincodeValid = status === "valid" || (form.postal_code.length === 6 && /^[1-9][0-9]{5}$/.test(form.postal_code) && !!form.city);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Delivery Address</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="edit-label">Label</Label>
              <Input
                id="edit-label"
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="edit-full-name">Full Name</Label>
              <Input
                id="edit-full-name"
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="edit-phone">Mobile Number</Label>
            <Input
              id="edit-phone"
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              required
            />
          </div>

          <div>
            <Label htmlFor="edit-postal-code">Pincode</Label>
            <div className="relative">
              <Input
                id="edit-postal-code"
                value={form.postal_code}
                onChange={handlePincodeChange}
                maxLength={6}
                required
              />
              {status === "loading" && (
                <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="edit-address1">Flat, House no., Building</Label>
            <Input
              id="edit-address1"
              value={form.address_line1}
              onChange={(e) => setForm({ ...form, address_line1: e.target.value })}
              required
            />
          </div>

          <div>
            <Label htmlFor="edit-address2">Area, Street, Sector (Optional)</Label>
            <Input
              id="edit-address2"
              value={form.address_line2}
              onChange={(e) => setForm({ ...form, address_line2: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="edit-city">Town / City</Label>
              <Input
                id="edit-city"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                required
                readOnly={isPincodeValid}
                className={isPincodeValid ? "bg-muted/50 text-muted-foreground cursor-not-allowed" : ""}
              />
            </div>
            <div>
              <Label htmlFor="edit-state">State</Label>
              <Input
                id="edit-state"
                value={form.state}
                onChange={(e) => setForm({ ...form, state: e.target.value })}
                required
                readOnly={isPincodeValid}
                className={isPincodeValid ? "bg-muted/50 text-muted-foreground cursor-not-allowed" : ""}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
