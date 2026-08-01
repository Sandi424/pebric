import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { PageLayout } from "@/components/layouts/PageLayout";
import { useAuth } from "@/contexts/AuthContext";
import {
  usePets,
  useAddPet,
  useUpdatePet,
  useDeletePet,
  useSetPrimaryPet,
  getRecommendedSize,
  Pet,
} from "@/hooks/usePets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/client";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  Crown,
  Dog,
  Cat,
  Upload,
  Ruler,
} from "lucide-react";
import { SEOHead } from "@/components/SEOHead";
import { OptimizedImage } from "@/components/ui/optimized-image";
import { compressImageToWebP } from "@/lib/image-compress";

const speciesOptions = [
  { value: "dog", label: "Dog", icon: Dog },
  { value: "cat", label: "Cat", icon: Cat },
];

interface PetFormProps {
  form: Partial<Pet>;
  setForm: (form: Partial<Pet>) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  isEditing: boolean;
  onPhotoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  uploading: boolean;
  fileInputRef: React.RefObject<HTMLInputElement>;
}

const PetForm = ({
  form,
  setForm,
  onSubmit,
  isSubmitting,
  isEditing,
  onPhotoUpload,
  uploading,
  fileInputRef,
}: PetFormProps) => (
  <div className="space-y-6">
    {/* Photo Upload */}
    <div className="flex justify-center">
      <div className="relative">
        <div className="h-24 w-24 overflow-hidden rounded-full bg-muted">
          {form.photo_url ? (
            <OptimizedImage
              src={form.photo_url}
              alt=""
              className="h-full w-full object-cover"
              sizes="96px"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              {form.species === "cat" ? (
                <Cat className="h-10 w-10 text-muted-foreground" />
              ) : (
                <Dog className="h-10 w-10 text-muted-foreground" />
              )}
            </div>
          )}
        </div>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="absolute -bottom-1 -right-1 rounded-full bg-primary p-2 text-primary-foreground"
          disabled={uploading}
        >
          <Upload className="h-4 w-4" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onPhotoUpload}
        />
      </div>
    </div>

    {/* Basic Info */}
    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <Label>Name *</Label>
        <Input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Pet's name"
        />
      </div>
      <div>
        <Label>Species</Label>
        <div className="flex gap-2 mt-1">
          {speciesOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setForm({ ...form, species: opt.value })}
              className={`flex-1 flex items-center justify-center gap-2 rounded-md border p-3 transition-colors ${
                form.species === opt.value
                  ? "border-primary bg-primary/10"
                  : "border-border"
              }`}
            >
              <opt.icon className="h-5 w-5" />
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>

    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <Label>Breed</Label>
        <Input
          value={form.breed}
          onChange={(e) => setForm({ ...form, breed: e.target.value })}
          placeholder="e.g., Golden Retriever"
        />
      </div>
      <div>
        <Label>Birth Date</Label>
        <Input
          type="date"
          value={form.birth_date}
          onChange={(e) => setForm({ ...form, birth_date: e.target.value })}
        />
      </div>
    </div>

    {/* Measurements */}
    <div className="border-t pt-4">
      <div className="flex items-center gap-2 mb-4">
        <Ruler className="h-5 w-5 text-muted-foreground" />
        <span className="font-medium">
          Measurements (for size recommendations)
        </span>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <Label>Weight (kg)</Label>
          <Input
            type="number"
            step="0.1"
            value={form.weight_kg}
            onChange={(e) => setForm({ ...form, weight_kg: e.target.value })}
          />
        </div>
        <div>
          <Label>Height (cm)</Label>
          <Input
            type="number"
            step="0.1"
            value={form.height_cm}
            onChange={(e) => setForm({ ...form, height_cm: e.target.value })}
          />
        </div>
        <div>
          <Label>Length (cm)</Label>
          <Input
            type="number"
            step="0.1"
            value={form.length_cm}
            onChange={(e) => setForm({ ...form, length_cm: e.target.value })}
          />
        </div>
        <div>
          <Label>Neck (cm)</Label>
          <Input
            type="number"
            step="0.1"
            value={form.neck_cm}
            onChange={(e) => setForm({ ...form, neck_cm: e.target.value })}
          />
        </div>
        <div>
          <Label>Chest (cm)</Label>
          <Input
            type="number"
            step="0.1"
            value={form.chest_cm}
            onChange={(e) => setForm({ ...form, chest_cm: e.target.value })}
          />
        </div>
      </div>
    </div>

    <div>
      <Label>Notes</Label>
      <Textarea
        value={form.notes}
        onChange={(e) => setForm({ ...form, notes: e.target.value })}
        placeholder="Any special notes about your pet..."
      />
    </div>

    <Button onClick={onSubmit} className="w-full" disabled={isSubmitting}>
      {isEditing ? "Update Pet" : "Add Pet"}
    </Button>
  </div>
);

export default function Pets() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const { data: pets = [], isLoading } = usePets();
  const addPet = useAddPet();
  const updatePet = useUpdatePet();
  const deletePet = useDeletePet();
  const setPrimary = useSetPrimaryPet();

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingPet, setEditingPet] = useState<Pet | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    name: "",
    species: "dog",
    breed: "",
    birth_date: "",
    weight_kg: "",
    height_cm: "",
    neck_cm: "",
    chest_cm: "",
    length_cm: "",
    photo_url: "",
    notes: "",
    is_primary: false,
  });

  if (!authLoading && !user) {
    navigate("/login");
    return null;
  }

  const resetForm = () => {
    setForm({
      name: "",
      species: "dog",
      breed: "",
      birth_date: "",
      weight_kg: "",
      height_cm: "",
      neck_cm: "",
      chest_cm: "",
      length_cm: "",
      photo_url: "",
      notes: "",
      is_primary: false,
    });
  };

  const handleEdit = (pet: Pet) => {
    setEditingPet(pet);
    setForm({
      name: pet.name,
      species: pet.species,
      breed: pet.breed || "",
      birth_date: pet.birth_date || "",
      weight_kg: pet.weight_kg?.toString() || "",
      height_cm: pet.height_cm?.toString() || "",
      neck_cm: pet.neck_cm?.toString() || "",
      chest_cm: pet.chest_cm?.toString() || "",
      length_cm: pet.length_cm?.toString() || "",
      photo_url: pet.photo_url || "",
      notes: pet.notes || "",
      is_primary: pet.is_primary,
    });
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Reset the input value so the same file can be selected again if needed
    e.target.value = "";

    setUploading(true);
    try {
      const compressedBlob = await compressImageToWebP(file, { maxWidth: 600, maxHeight: 600, quality: 0.8 });
      const fileName = `${user.id}/${Date.now()}.webp`;

      // Attempt Supabase Storage upload
      const { error: uploadError } = await supabase.storage
        .from("pet-photos")
        .upload(fileName, compressedBlob, {
          contentType: "image/webp",
          upsert: false,
        });

      if (!uploadError) {
        // Storage upload succeeded — use the public URL
        const { data: { publicUrl } } = supabase.storage
          .from("pet-photos")
          .getPublicUrl(fileName);
        setForm((prev) => ({ ...prev, photo_url: publicUrl }));
        toast.success("Photo uploaded successfully");
        return;
      }

      // Storage upload failed — log the real error for debugging
      console.warn("Supabase Storage upload failed:", uploadError.message, uploadError);

      // Fallback: convert to base64 data URL and store directly
      // This works regardless of bucket configuration
      const reader = new FileReader();
      reader.onload = (evt) => {
        const dataUrl = evt.target?.result as string;
        if (dataUrl) {
          setForm((prev) => ({ ...prev, photo_url: dataUrl }));
          toast.success("Photo added (stored locally)");
        } else {
          toast.error("Failed to read photo");
        }
      };
      reader.onerror = () => {
        toast.error("Failed to process photo");
      };
      reader.readAsDataURL(compressedBlob);
    } catch (err) {
      console.error("Photo upload error:", err);
      toast.error("Failed to process photo");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast.error("Please enter a name for your pet");
      return;
    }

    const petData = {
      name: form.name,
      species: form.species,
      breed: form.breed || null,
      birth_date: form.birth_date || null,
      weight_kg: form.weight_kg ? parseFloat(form.weight_kg) : null,
      height_cm: form.height_cm ? parseFloat(form.height_cm) : null,
      neck_cm: form.neck_cm ? parseFloat(form.neck_cm) : null,
      chest_cm: form.chest_cm ? parseFloat(form.chest_cm) : null,
      length_cm: form.length_cm ? parseFloat(form.length_cm) : null,
      photo_url: form.photo_url || null,
      notes: form.notes || null,
      is_primary: form.is_primary || pets.length === 0,
    };

    if (editingPet) {
      await updatePet.mutateAsync({ id: editingPet.id, ...petData });
      setEditingPet(null);
    } else {
      await addPet.mutateAsync(petData);
      setIsAddOpen(false);
    }

    resetForm();
  };

  const handleDelete = async (pet: Pet) => {
    if (!confirm(`Are you sure you want to remove ${pet.name}?`)) return;
    await deletePet.mutateAsync(pet.id);
  };

  if (authLoading || isLoading) {
    return (
      <PageLayout>
        <div className="container mx-auto px-6 py-16 flex justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <SEOHead
        title="My Pets"
        description="Manage your pet profiles for personalized size recommendations."
        noindex={true}
      />
      <div className="container mx-auto px-6 py-16">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="font-display text-4xl font-medium">My Pets</h1>
            <p className="mt-2 text-muted-foreground">
              Manage your pet profiles for personalized recommendations
            </p>
          </div>
          <Dialog
            open={isAddOpen}
            onOpenChange={(open) => {
              setIsAddOpen(open);
              if (!open) resetForm();
            }}
          >
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Pet
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[95vw] max-w-[500px] max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New Pet</DialogTitle>
              </DialogHeader>
              <PetForm
                form={form}
                setForm={setForm}
                onSubmit={handleSubmit}
                isSubmitting={addPet.isPending || updatePet.isPending}
                isEditing={false}
                onPhotoUpload={handlePhotoUpload}
                uploading={uploading}
                fileInputRef={fileInputRef}
              />
            </DialogContent>
          </Dialog>
        </div>

        {pets.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-12 text-center">
            <Dog className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 font-display text-xl font-medium">
              No pets yet
            </h3>
            <p className="mt-2 text-muted-foreground">
              Add your first pet to get personalized size recommendations
            </p>
            <Button onClick={() => setIsAddOpen(true)} className="mt-4">
              <Plus className="mr-2 h-4 w-4" />
              Add Your First Pet
            </Button>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {pets.map((pet) => {
              const recommendedSize = getRecommendedSize(pet);
              return (
                <div
                  key={pet.id}
                  className="relative rounded-lg border border-border bg-card p-6"
                >
                  {pet.is_primary && (
                    <div className="absolute -top-3 left-4 flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs text-primary-foreground">
                      <Crown className="h-3 w-3" />
                      Primary
                    </div>
                  )}

                  <div className="flex items-start gap-4">
                    <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-full bg-muted">
                      {pet.photo_url ? (
                        <OptimizedImage
                          src={pet.photo_url}
                          alt={pet.name}
                          className="h-full w-full object-cover"
                          sizes="64px"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          {pet.species === "cat" ? (
                            <Cat className="h-8 w-8 text-muted-foreground" />
                          ) : (
                            <Dog className="h-8 w-8 text-muted-foreground" />
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="font-display text-xl font-medium">
                        {pet.name}
                      </h3>
                      <p className="text-sm text-muted-foreground capitalize">
                        {pet.breed || pet.species}
                      </p>
                      {recommendedSize && (
                        <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-accent px-3 py-1 text-xs">
                          <Ruler className="h-3 w-3" />
                          Recommended: Size {recommendedSize}
                        </div>
                      )}
                    </div>
                  </div>

                  {(pet.weight_kg || pet.chest_cm) && (
                    <div className="mt-4 grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                      {pet.weight_kg && <span>Weight: {pet.weight_kg} kg</span>}
                      {pet.chest_cm && <span>Chest: {pet.chest_cm} cm</span>}
                    </div>
                  )}

                  <div className="mt-4 flex gap-2">
                    {!pet.is_primary && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPrimary.mutate(pet.id)}
                      >
                        <Crown className="mr-1 h-3 w-3" />
                        Set Primary
                      </Button>
                    )}
                    <Dialog
                      open={editingPet?.id === pet.id}
                      onOpenChange={(open) => {
                        if (!open) {
                          setEditingPet(null);
                          resetForm();
                        }
                      }}
                    >
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(pet)}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="w-[95vw] max-w-[500px] max-h-[85vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>Edit {pet.name}</DialogTitle>
                        </DialogHeader>
                        <PetForm
                          form={form}
                          setForm={setForm}
                          onSubmit={handleSubmit}
                          isSubmitting={addPet.isPending || updatePet.isPending}
                          isEditing={true}
                          onPhotoUpload={handlePhotoUpload}
                          uploading={uploading}
                          fileInputRef={fileInputRef}
                        />
                      </DialogContent>
                    </Dialog>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(pet)}
                      className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </PageLayout>
  );
}
