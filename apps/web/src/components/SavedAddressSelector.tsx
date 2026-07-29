import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  useSavedAddresses,
  useCreateSavedAddress,
  useDeleteSavedAddress,
  SavedAddress,
} from "@/hooks/useSavedAddresses";
import { useAuth } from "@/contexts/AuthContext";
import { Plus, MapPin, Trash2, Check, Loader2, XCircle } from "lucide-react";
import { usePincodeLookup } from "@/hooks/usePincodeLookup";

const POSTAL_CODE_RE = /^[1-9][0-9]{5}$/;
const PHONE_RE = /^[6-9]\d{9}$/;

interface SavedAddressSelectorProps {
  onAddressSelect: (address: {
    firstName: string;
    lastName: string;
    address: string;
    city: string;
    postalCode: string;
    country: string;
    phone: string;
  }) => void;
}

export function SavedAddressSelector({
  onAddressSelect,
}: SavedAddressSelectorProps) {
  const { user } = useAuth();
  const { data: addresses = [] } = useSavedAddresses();
  const createAddress = useCreateSavedAddress();
  const deleteAddress = useDeleteSavedAddress();

  const [selectedId, setSelectedId] = useState<string>("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [newAddress, setNewAddress] = useState({
    label: "Home",
    full_name: "",
    phone: "",
    address_line1: "",
    address_line2: "",
    city: "",
    state: "",
    postal_code: "",
    country: "India",
    is_default: false,
  });

  if (!user) return null;

  const handleSelectAddress = (addressId: string) => {
    setSelectedId(addressId);
    const address = addresses.find((a) => a.id === addressId);
    if (address) {
      const nameParts = address.full_name.split(" ");
      onAddressSelect({
        firstName: nameParts[0] || "",
        lastName: nameParts.slice(1).join(" ") || "",
        address: [address.address_line1, address.address_line2]
          .filter(Boolean)
          .join(", "),
        city: address.city,
        postalCode: address.postal_code,
        country: address.country,
        phone: address.phone || "",
      });
    }
  };

  const handleAddAddress = async () => {
    await createAddress.mutateAsync(newAddress);
    setShowAddForm(false);
    setNewAddress({
      label: "Home",
      full_name: "",
      phone: "",
      address_line1: "",
      address_line2: "",
      city: "",
      state: "",
      postal_code: "",
      country: "India",
      is_default: false,
    });
  };

  if (addresses.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-4">
        <p className="text-sm text-muted-foreground mb-3">
          Save your address for faster checkout next time
        </p>
        <Dialog open={showAddForm} onOpenChange={setShowAddForm}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Add Address
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Address</DialogTitle>
            </DialogHeader>
            <AddressForm
              address={newAddress}
              onChange={setNewAddress}
              onSubmit={handleAddAddress}
              isLoading={createAddress.isPending}
            />
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Saved Addresses</Label>
        <Dialog open={showAddForm} onOpenChange={setShowAddForm}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm">
              <Plus className="mr-1 h-4 w-4" />
              Add New
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Address</DialogTitle>
            </DialogHeader>
            <AddressForm
              address={newAddress}
              onChange={setNewAddress}
              onSubmit={handleAddAddress}
              isLoading={createAddress.isPending}
            />
          </DialogContent>
        </Dialog>
      </div>

      <RadioGroup value={selectedId} onValueChange={handleSelectAddress}>
        <div className="space-y-2">
          {addresses.map((address) => (
            <div
              key={address.id}
              className={`relative rounded-lg border p-4 ${
                selectedId === address.id ? "border-primary" : "border-border"
              }`}
            >
              <div className="flex items-start gap-3">
                <RadioGroupItem
                  value={address.id}
                  id={address.id}
                  className="mt-1"
                />
                <Label htmlFor={address.id} className="flex-1 cursor-pointer">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    <span className="font-medium">{address.label}</span>
                    {address.is_default && (
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                        Default
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {address.full_name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {address.address_line1}
                    {address.address_line2 && `, ${address.address_line2}`}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {address.city}, {address.postal_code}, {address.country}
                  </p>
                </Label>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => deleteAddress.mutate(address.id)}
                >
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </RadioGroup>
    </div>
  );
}

function AddressForm({
  address,
  onChange,
  onSubmit,
  isLoading,
}: {
  address: Partial<SavedAddress>;
  onChange: (address: Partial<SavedAddress>) => void;
  onSubmit: () => void;
  isLoading: boolean;
}) {
  const { status, fetchPincode, resetStatus } = usePincodeLookup();

  const handlePincodeChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const pin = e.target.value.trim();
      resetStatus();
      if (pin.length === 6 && POSTAL_CODE_RE.test(pin)) {
        onChange({ ...address, postal_code: pin });
        const result = await fetchPincode(pin);
        if (result) {
          onChange({
            ...address,
            postal_code: pin,
            city: result.city,
            state: result.state,
            country: result.country,
          });
        }
      } else {
        onChange({ ...address, postal_code: pin, city: "", state: "" });
      }
    },
    [address, onChange, fetchPincode, resetStatus]
  );

  const postalCode = address.postal_code || "";
  const phone = address.phone || "";
  const phoneDigits = phone.replace(/[\s\-().]/g, "");
  const phoneInvalid = phone.trim() !== "" && phone.trim() !== "+91" && !PHONE_RE.test(phoneDigits);
  const isPincodeValid = status === "valid" || (postalCode.length === 6 && POSTAL_CODE_RE.test(postalCode) && !!address.city);

  const isValid =
    !isLoading &&
    !phoneInvalid &&
    status !== "invalid" &&
    status !== "loading" &&
    !!address.label?.trim() &&
    !!address.full_name?.trim() &&
    !!address.phone?.trim() &&
    !!address.address_line1?.trim() &&
    postalCode.length === 6 &&
    POSTAL_CODE_RE.test(postalCode) &&
    !!address.city?.trim() &&
    !!address.state?.trim();

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Label <span className="text-destructive">*</span></Label>
          <Input
            value={address.label || ""}
            onChange={(e) => onChange({ ...address, label: e.target.value })}
            placeholder="Home, Work, etc."
          />
        </div>
        <div>
          <Label>Full Name <span className="text-destructive">*</span></Label>
          <Input
            value={address.full_name || ""}
            onChange={(e) =>
              onChange({ ...address, full_name: e.target.value })
            }
            placeholder="John Doe"
          />
        </div>
      </div>
      <div>
        <Label>Phone <span className="text-destructive">*</span></Label>
        <Input
          value={address.phone || ""}
          onChange={(e) => onChange({ ...address, phone: e.target.value })}
          placeholder="+91 98765 43210"
          className={phoneInvalid ? "border-destructive" : ""}
        />
        {phoneInvalid && <p className="mt-1 text-xs text-destructive">Enter a valid 10-digit mobile number</p>}
      </div>
      <div>
        <Label>Pincode <span className="text-destructive">*</span></Label>
        <div className="relative">
          <Input
            value={postalCode}
            onChange={handlePincodeChange}
            maxLength={6}
            placeholder="6-digit PIN"
            className={status === "invalid" ? "border-destructive" : ""}
          />
          {status === "loading" && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
          {status === "invalid" && <XCircle className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-destructive" />}
        </div>
        {status === "loading" && <p className="mt-1 text-xs text-muted-foreground">Verifying PIN code...</p>}
        {status === "invalid" && <p className="mt-1 text-xs text-destructive">PIN code not found in records.</p>}
      </div>
      <div>
        <Label>Address Line 1 <span className="text-destructive">*</span></Label>
        <Input
          value={address.address_line1 || ""}
          onChange={(e) =>
            onChange({ ...address, address_line1: e.target.value })
          }
          placeholder="Street address"
        />
      </div>
      <div>
        <Label>Address Line 2 (Optional)</Label>
        <Input
          value={address.address_line2 || ""}
          onChange={(e) =>
            onChange({ ...address, address_line2: e.target.value })
          }
          placeholder="Apartment, suite, etc."
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>City <span className="text-destructive">*</span></Label>
          <Input
            value={address.city || ""}
            onChange={(e) => onChange({ ...address, city: e.target.value })}
            readOnly={isPincodeValid}
            className={isPincodeValid ? "bg-muted/50 text-muted-foreground cursor-not-allowed" : ""}
          />
        </div>
        <div>
          <Label>State <span className="text-destructive">*</span></Label>
          <Input
            value={address.state || ""}
            onChange={(e) => onChange({ ...address, state: e.target.value })}
            readOnly={isPincodeValid}
            className={isPincodeValid ? "bg-muted/50 text-muted-foreground cursor-not-allowed" : ""}
          />
        </div>
      </div>
      <div>
        <Label>Country</Label>
        <Input
          value="India"
          readOnly
          className="bg-muted/50 text-muted-foreground cursor-not-allowed"
        />
      </div>
      <Button onClick={onSubmit} disabled={!isValid} className="w-full">
        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        {isLoading ? "Saving..." : "Save Address"}
      </Button>
    </div>
  );
}
