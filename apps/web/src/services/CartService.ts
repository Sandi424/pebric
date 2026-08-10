import { supabase } from '@/integrations/client';
import { CartItemModel, CartItemData, RawCartItemRecord } from '@/domain/models/CartItem';

/**
 * CartService handles all cart-related business operations.
 * Encapsulates Supabase interactions and business logic.
 */
export class CartService {
  constructor(private readonly userId: string | null) {}

  /**
   * Check if user is authenticated
   */
  get isAuthenticated(): boolean {
    return this.userId !== null;
  }

  /**
   * Load cart items from database
   */
  async loadCart(): Promise<CartItemData[]> {
    if (!this.userId) return [];

    const { data: cartData, error } = await supabase
      .from('cart_items')
      .select(`
        *,
        product:products (
          id,
          name,
          price,
          image_url,
          images,
          slug,
          sizes,
          pet_sizes
        )
      `)
      .eq('user_id', this.userId);

    if (error) {
      console.error('Error loading cart:', error);
      return [];
    }

    if (!cartData) return [];

    return this.groupCartItems(cartData as RawCartItemRecord[]);
  }

  /**
   * Group raw cart data by product-size combination
   */
  groupCartItems(rawItems: RawCartItemRecord[]): CartItemData[] {
    const groupedItems = new Map<string, CartItemModel>();

    rawItems.forEach((record) => {
      const item = CartItemModel.fromDatabaseRecord(record);
      const key = item.key;

      if (groupedItems.has(key)) {
        const existing = groupedItems.get(key)!;
        const newOwnerQty = existing.ownerQuantity + item.ownerQuantity;
        const newPetQty = existing.petQuantity + item.petQuantity;
        groupedItems.set(
          key,
          new CartItemModel(
            existing.id,
            existing.name,
            existing.price,
            existing.image,
            existing.ownerSize,
            existing.petSize,
            newOwnerQty + newPetQty,
            existing.slug,
            existing.type,
            newOwnerQty,
            newPetQty
          )
        );
      } else {
        groupedItems.set(key, item);
      }
    });

    return Array.from(groupedItems.values()).map((item) => item.toPlainObject());
  }

  /**
   * Add item to cart in database
   */
  async addItem(item: Omit<CartItemData, 'quantity'>): Promise<void> {
    if (!this.userId) return;

    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(item.id));
    if (!isUUID) {
      console.warn("Product ID is not a valid UUID, skipping DB cart sync:", item.id);
      return;
    }

    const ownerSize = CartItemModel.normalizeSize(item.ownerSize);
    const petSize = CartItemModel.normalizeSize(item.petSize);
    const serializedOwner = CartItemModel.serializeSize(ownerSize, item.ownerQuantity);
    const serializedPet = CartItemModel.serializeSize(petSize, item.petQuantity);
    const combinedQuantity = item.ownerQuantity + item.petQuantity;

    try {
      // 1. Try RPC first (SECURITY DEFINER bypasses RLS safely)
      const { error: rpcError } = await supabase.rpc('add_cart_item' as any, {
        p_product_id: item.id as string,
        p_size: serializedOwner,
        p_pet_size: serializedPet,
        p_quantity: combinedQuantity,
      });

      if (!rpcError) {
        return;
      }

      console.warn('RPC add_cart_item error, trying direct table operations:', rpcError.message);

      // 2. Fetch existing rows for fallback direct table operations
      const { data: existingRows, error: fetchError } = await supabase
        .from('cart_items')
        .select('*')
        .eq('user_id', this.userId)
        .eq('product_id', item.id);

      if (fetchError) {
        console.warn('Cart items fetch notice:', fetchError.message);
        return;
      }

      // Find matching row
      const matchedRow = existingRows?.find(row => {
        const parsedOwner = CartItemModel.deserializeSize(row.size);
        const parsedPet = CartItemModel.deserializeSize(row.pet_size);
        return parsedOwner.size === ownerSize && parsedPet.size === petSize;
      });

      if (matchedRow) {
        const parsedOwner = CartItemModel.deserializeSize(matchedRow.size);
        const parsedPet = CartItemModel.deserializeSize(matchedRow.pet_size);

        const newOwnerQty = parsedOwner.quantity + item.ownerQuantity;
        const newPetQty = parsedPet.quantity + item.petQuantity;
        const newQuantity = newOwnerQty + newPetQty;

        const updatedOwner = CartItemModel.serializeSize(ownerSize, newOwnerQty);
        const updatedPet = CartItemModel.serializeSize(petSize, newPetQty);

        const { error: updateError } = await supabase
          .from('cart_items')
          .update({
            size: updatedOwner,
            pet_size: updatedPet,
            quantity: newQuantity
          })
          .eq('id', matchedRow.id);

        if (updateError) {
          console.warn('Cart items update notice:', updateError.message);
        }
      } else {
        const { error: insertError } = await supabase
          .from('cart_items')
          .insert({
            user_id: this.userId,
            product_id: item.id as string,
            size: serializedOwner,
            pet_size: serializedPet,
            quantity: combinedQuantity
          });

        if (insertError) {
          console.warn('Cart items insert notice:', insertError.message);
        }
      }
    } catch (err) {
      console.warn('Cart sync notice:', err);
    }
  }

  /**
   * Remove item from cart in database
   */
  async removeItem(productId: string | number, ownerSize: string, petSize: string): Promise<void> {
    if (!this.userId) return;

    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(productId));
    if (!isUUID) return;

    const normalizedOwnerSize = CartItemModel.normalizeSize(ownerSize);
    const normalizedPetSize = CartItemModel.normalizeSize(petSize);

    try {
      const { error: rpcError } = await supabase.rpc('remove_cart_item' as any, {
        p_product_id: productId as string,
        p_size: normalizedOwnerSize,
        p_pet_size: normalizedPetSize,
      });

      if (!rpcError) return;
    } catch {
      // fallback to direct delete
    }

    try {
      const { data: existingRows, error: fetchError } = await supabase
        .from('cart_items')
        .select('*')
        .eq('user_id', this.userId)
        .eq('product_id', productId);

      if (fetchError) return;

      const matchedRow = existingRows?.find(row => {
        const parsedOwner = CartItemModel.deserializeSize(row.size);
        const parsedPet = CartItemModel.deserializeSize(row.pet_size);
        return parsedOwner.size === normalizedOwnerSize && parsedPet.size === normalizedPetSize;
      });

      if (matchedRow) {
        await supabase
          .from('cart_items')
          .delete()
          .eq('id', matchedRow.id);
      }
    } catch (err) {
      console.warn('Cart remove notice:', err);
    }
  }

  /**
   * Update item quantity in database
   */
  async updateQuantity(
    productId: string | number,
    ownerSize: string,
    petSize: string,
    ownerQuantity: number,
    petQuantity: number
  ): Promise<void> {
    if (!this.userId) return;

    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(productId));
    if (!isUUID) return;

    if (ownerQuantity < 1 && petQuantity < 1) {
      await this.removeItem(productId, ownerSize, petSize);
      return;
    }

    const normalizedOwnerSize = CartItemModel.normalizeSize(ownerSize);
    const normalizedPetSize = CartItemModel.normalizeSize(petSize);
    const serializedOwner = CartItemModel.serializeSize(normalizedOwnerSize, ownerQuantity);
    const serializedPet = CartItemModel.serializeSize(normalizedPetSize, petQuantity);
    const newQuantity = ownerQuantity + petQuantity;

    try {
      const { error: rpcError } = await supabase.rpc('set_cart_item_quantity' as any, {
        p_product_id: productId as string,
        p_size: normalizedOwnerSize,
        p_pet_size: normalizedPetSize,
        p_quantity: newQuantity,
      });

      if (!rpcError) return;
    } catch {
      // fallback to direct table update
    }

    try {
      const { data: existingRows, error: fetchError } = await supabase
        .from('cart_items')
        .select('*')
        .eq('user_id', this.userId)
        .eq('product_id', productId);

      if (fetchError) return;

      const matchedRow = existingRows?.find(row => {
        const parsedOwner = CartItemModel.deserializeSize(row.size);
        const parsedPet = CartItemModel.deserializeSize(row.pet_size);
        return parsedOwner.size === normalizedOwnerSize && parsedPet.size === normalizedPetSize;
      });

      if (matchedRow) {
        await supabase
          .from('cart_items')
          .update({
            size: serializedOwner,
            pet_size: serializedPet,
            quantity: newQuantity
          })
          .eq('id', matchedRow.id);
      }
    } catch (err) {
      console.warn('Cart quantity update notice:', err);
    }
  }

  /**
   * Clear all items from user's cart
   */
  async clearCart(): Promise<void> {
    if (!this.userId) return;
    const { error } = await supabase.from('cart_items').delete().eq('user_id', this.userId);
    if (error) throw error;
  }

  /**
   * Calculate cart totals
   */
  static calculateTotals(items: CartItemData[]): CartTotals {
    const itemCount = items.reduce((sum, item) => sum + ((item.ownerQuantity || 0) + (item.petQuantity || 0) || item.quantity || 1), 0);
    const subtotal = items.reduce((sum, item) => {
      const isMatchingSet = item.ownerSize !== 'N/A' && item.petSize !== 'N/A';
      if (isMatchingSet) {
        const halfPrice = Math.round(item.price * 0.5);
        return sum + (item.ownerSize !== 'N/A' ? (item.ownerQuantity || 0) * halfPrice : 0) +
                     (item.petSize !== 'N/A' ? (item.petQuantity || 0) * halfPrice : 0);
      } else {
        const qty = item.ownerSize !== 'N/A'
          ? (item.ownerQuantity || item.quantity || 1)
          : item.petSize !== 'N/A'
            ? (item.petQuantity || item.quantity || 1)
            : (item.quantity || (item.ownerQuantity + item.petQuantity) || 1);
        return sum + item.price * qty;
      }
    }, 0);

    return {
      itemCount,
      subtotal,
    };
  }
}

export interface CartTotals {
  itemCount: number;
  subtotal: number;
}
