import { useState } from "react";
import { useAllPromoBanners } from "@/hooks/usePromoBanners";
import { fromTable } from "@/lib/supabaseUntyped";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Save, ArrowUp, ArrowDown } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

interface PromoBannerForm {
  badge_text: string;
  headline: string;
  subheadline: string;
  cta_text: string;
  cta_link: string;
  discount_percentage: number | null;
  end_date: string;
  background_color: string;
  text_color: string;
  display_order: number;
  is_active: boolean;
}

export function PromoBannersManager() {
  const { data: banners = [], isLoading } = useAllPromoBanners();
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAddingBanner, setIsAddingBanner] = useState(false);

  const [newBanner, setNewBanner] = useState<PromoBannerForm>({
    badge_text: "Limited Time Offer",
    headline: "",
    subheadline: "",
    cta_text: "Shop Now",
    cta_link: "/shop",
    discount_percentage: null,
    end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
    background_color: "#000000",
    text_color: "#FFFFFF",
    display_order: banners.length + 1,
    is_active: true,
  });

  const [editForm, setEditForm] = useState<PromoBannerForm>({
    badge_text: "",
    headline: "",
    subheadline: "",
    cta_text: "",
    cta_link: "",
    discount_percentage: null,
    end_date: "",
    background_color: "#000000",
    text_color: "#FFFFFF",
    display_order: 0,
    is_active: true,
  });

  const handleAddBanner = async () => {
    if (!newBanner.headline) {
      toast.error("Please fill in the headline");
      return;
    }

    const { error } = await fromTable("promo_banners").insert({
      badge_text: newBanner.badge_text,
      headline: newBanner.headline,
      subheadline: newBanner.subheadline || null,
      cta_text: newBanner.cta_text || null,
      cta_link: newBanner.cta_link || null,
      discount_percentage: newBanner.discount_percentage,
      end_date: newBanner.end_date,
      background_color: newBanner.background_color,
      text_color: newBanner.text_color,
      display_order: newBanner.display_order,
      is_active: newBanner.is_active,
    });

    if (error) {
      toast.error("Failed to add promo banner");
      return;
    }

    toast.success("Promo banner added successfully");
    queryClient.invalidateQueries({ queryKey: ["promo-banners"] });
    queryClient.invalidateQueries({ queryKey: ["all-promo-banners"] });
    setIsAddingBanner(false);
    setNewBanner({
      badge_text: "Limited Time Offer",
      headline: "",
      subheadline: "",
      cta_text: "Shop Now",
      cta_link: "/shop",
      discount_percentage: null,
      end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
      background_color: "#000000",
      text_color: "#FFFFFF",
      display_order: banners.length + 1,
      is_active: true,
    });
  };

  const handleEdit = (banner: any) => {
    setEditingId(banner.id);
    setEditForm({
      badge_text: banner.badge_text,
      headline: banner.headline,
      subheadline: banner.subheadline || "",
      cta_text: banner.cta_text || "",
      cta_link: banner.cta_link || "",
      discount_percentage: banner.discount_percentage,
      end_date: new Date(banner.end_date).toISOString().slice(0, 16),
      background_color: banner.background_color,
      text_color: banner.text_color,
      display_order: banner.display_order,
      is_active: banner.is_active,
    });
  };

  const handleSave = async () => {
    if (!editingId) return;

    const { error } = await fromTable("promo_banners")
      .update({
        badge_text: editForm.badge_text,
        headline: editForm.headline,
        subheadline: editForm.subheadline || null,
        cta_text: editForm.cta_text || null,
        cta_link: editForm.cta_link || null,
        discount_percentage: editForm.discount_percentage,
        end_date: editForm.end_date,
        background_color: editForm.background_color,
        text_color: editForm.text_color,
        display_order: editForm.display_order,
        is_active: editForm.is_active,
      })
      .eq("id", editingId);

    if (error) {
      toast.error("Failed to update promo banner");
      return;
    }

    toast.success("Promo banner updated successfully");
    queryClient.invalidateQueries({ queryKey: ["promo-banners"] });
    queryClient.invalidateQueries({ queryKey: ["all-promo-banners"] });
    setEditingId(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this promo banner?")) return;

    const { error } = await fromTable("promo_banners").delete().eq("id", id);

    if (error) {
      toast.error("Failed to delete promo banner");
      return;
    }

    toast.success("Promo banner deleted successfully");
    queryClient.invalidateQueries({ queryKey: ["promo-banners"] });
    queryClient.invalidateQueries({ queryKey: ["all-promo-banners"] });
  };

  const handleMove = async (id: string, direction: "up" | "down") => {
    const currentIndex = banners.findIndex((b) => b.id === id);
    if (currentIndex === -1) return;

    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= banners.length) return;

    const currentBanner = banners[currentIndex];
    const targetBanner = banners[targetIndex];

    await Promise.all([
      fromTable("promo_banners")
        .update({ display_order: targetBanner.display_order })
        .eq("id", currentBanner.id),
      fromTable("promo_banners")
        .update({ display_order: currentBanner.display_order })
        .eq("id", targetBanner.id),
    ]);

    toast.success("Banner order updated");
    queryClient.invalidateQueries({ queryKey: ["promo-banners"] });
    queryClient.invalidateQueries({ queryKey: ["all-promo-banners"] });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Promo Banners</h2>
          <p className="text-muted-foreground">
            Manage promotional banners with countdown timers
          </p>
        </div>
        <Dialog open={isAddingBanner} onOpenChange={setIsAddingBanner}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Promo Banner
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Add New Promo Banner</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="badge">Badge Text *</Label>
                <Input
                  id="badge"
                  value={newBanner.badge_text}
                  onChange={(e) => setNewBanner({ ...newBanner, badge_text: e.target.value })}
                  placeholder="Limited Time Offer"
                />
              </div>

              <div>
                <Label htmlFor="headline">Headline *</Label>
                <Input
                  id="headline"
                  value={newBanner.headline}
                  onChange={(e) => setNewBanner({ ...newBanner, headline: e.target.value })}
                  placeholder="Flat 20% Off"
                />
              </div>

              <div>
                <Label htmlFor="subheadline">Subheadline</Label>
                <Textarea
                  id="subheadline"
                  value={newBanner.subheadline}
                  onChange={(e) => setNewBanner({ ...newBanner, subheadline: e.target.value })}
                  placeholder="On All Pebric Sets"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="cta_text">CTA Text</Label>
                  <Input
                    id="cta_text"
                    value={newBanner.cta_text}
                    onChange={(e) => setNewBanner({ ...newBanner, cta_text: e.target.value })}
                    placeholder="Shop Now"
                  />
                </div>
                <div>
                  <Label htmlFor="cta_link">CTA Link</Label>
                  <Input
                    id="cta_link"
                    value={newBanner.cta_link}
                    onChange={(e) => setNewBanner({ ...newBanner, cta_link: e.target.value })}
                    placeholder="/shop"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="discount">Discount %</Label>
                  <Input
                    id="discount"
                    type="number"
                    value={newBanner.discount_percentage || ""}
                    onChange={(e) =>
                      setNewBanner({
                        ...newBanner,
                        discount_percentage: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                    placeholder="20"
                  />
                </div>
                <div>
                  <Label htmlFor="end_date">End Date *</Label>
                  <Input
                    id="end_date"
                    type="datetime-local"
                    value={newBanner.end_date}
                    onChange={(e) => setNewBanner({ ...newBanner, end_date: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="bg_color">Background Color</Label>
                  <Input
                    id="bg_color"
                    type="color"
                    value={newBanner.background_color}
                    onChange={(e) => setNewBanner({ ...newBanner, background_color: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="text_color">Text Color</Label>
                  <Input
                    id="text_color"
                    type="color"
                    value={newBanner.text_color}
                    onChange={(e) => setNewBanner({ ...newBanner, text_color: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={newBanner.is_active}
                  onChange={(e) => setNewBanner({ ...newBanner, is_active: e.target.checked })}
                />
                <Label htmlFor="is_active">Active</Label>
              </div>

              <Button onClick={handleAddBanner} className="w-full">
                Add Promo Banner
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-lg border border-border">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-border bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium">Headline</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Discount</th>
                <th className="px-4 py-3 text-left text-sm font-medium">End Date</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Order</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {banners.map((banner, index) => (
                <tr key={banner.id} className="border-b border-border">
                  <td className="px-4 py-3">
                    {editingId === banner.id ? (
                      <Input
                        value={editForm.headline}
                        onChange={(e) => setEditForm({ ...editForm, headline: e.target.value })}
                        className="w-48"
                      />
                    ) : (
                      <div>
                        <p className="font-medium">{banner.headline}</p>
                        <p className="text-sm text-muted-foreground line-clamp-1">
                          {banner.subheadline}
                        </p>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {banner.discount_percentage ? `${banner.discount_percentage}%` : "-"}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {new Date(banner.end_date).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${banner.is_active
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                        }`}
                    >
                      {banner.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleMove(banner.id, "up")}
                        disabled={index === 0}
                      >
                        <ArrowUp className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleMove(banner.id, "down")}
                        disabled={index === banners.length - 1}
                      >
                        <ArrowDown className="h-3 w-3" />
                      </Button>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      {editingId === banner.id ? (
                        <>
                          <Button size="sm" onClick={handleSave}>
                            <Save className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditingId(null)}
                          >
                            Cancel
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEdit(banner)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDelete(banner.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
