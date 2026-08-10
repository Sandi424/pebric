export class CartItemModel {
  constructor(
    public readonly id: number | string,
    public readonly name: string,
    public readonly price: number,
    public readonly image: string,
    public readonly ownerSize: string,
    public readonly petSize: string,
    public readonly quantity: number,
    public readonly slug: string,
    public readonly type: "owner" | "pet" | "combo" = "combo",
    public readonly ownerQuantity: number = 0,
    public readonly petQuantity: number = 0
  ) {}

  /**
   * Generate unique key for cart item (handles size variants)
   */
  get key(): string {
    return CartItemModel.generateKey(this.id, this.ownerSize, this.petSize);
  }

  /**
   * Calculate line total for this item using split pricing if it is a matching set
   */
  get lineTotal(): number {
    const isMatchingSet = this.ownerSize !== 'N/A' && this.petSize !== 'N/A';
    if (isMatchingSet) {
      const halfPrice = Math.round(this.price * 0.5);
      return (this.ownerSize !== 'N/A' ? (this.ownerQuantity || 0) * halfPrice : 0) +
             (this.petSize !== 'N/A' ? (this.petQuantity || 0) * halfPrice : 0);
    } else {
      if (this.ownerSize !== 'N/A') {
        return this.price * (this.ownerQuantity || this.quantity || 1);
      } else if (this.petSize !== 'N/A') {
        return this.price * (this.petQuantity || this.quantity || 1);
      }
      return this.price * (this.quantity || (this.ownerQuantity + this.petQuantity) || 1);
    }
  }

  /**
   * Create a new CartItemModel with updated quantities
   */
  withQuantities(ownerQty: number, petQty: number): CartItemModel {
    return new CartItemModel(
      this.id,
      this.name,
      this.price,
      this.image,
      this.ownerSize,
      this.petSize,
      ownerQty + petQty,
      this.slug,
      this.type,
      ownerQty,
      petQty
    );
  }

  /**
   * Check if this item matches another by product and sizes
   */
  matches(productId: number | string, ownerSize: string, petSize: string): boolean {
    return (
      this.id === productId &&
      this.ownerSize === CartItemModel.normalizeSize(ownerSize) &&
      this.petSize === CartItemModel.normalizeSize(petSize)
    );
  }

  /**
   * Convert to plain object (for context state)
   */
  toPlainObject(): CartItemData {
    return {
      id: this.id,
      name: this.name,
      price: this.price,
      image: this.image,
      ownerSize: this.ownerSize,
      petSize: this.petSize,
      quantity: this.quantity,
      slug: this.slug,
      type: this.type,
      ownerQuantity: this.ownerQuantity,
      petQuantity: this.petQuantity,
    };
  }

  /**
   * Static: Generate unique key for cart item
   */
  static generateKey(productId: string | number, ownerSize: string, petSize: string): string {
    return `${productId}-${CartItemModel.normalizeSize(ownerSize)}-${CartItemModel.normalizeSize(petSize)}`;
  }

  /**
   * Static: Normalize size value (handles null, empty, "N/A" consistently)
   */
  static normalizeSize(size: string | null | undefined): string {
    if (!size || size === '' || size === 'N/A') {
      return 'N/A';
    }
    return size;
  }

  /**
   * Static: Check if two sizes match (handles N/A equivalence)
   */
  static sizesMatch(size1: string, dbSize: string | null): boolean {
    const normalized1 = CartItemModel.normalizeSize(size1);
    const normalized2 = CartItemModel.normalizeSize(dbSize);

    if (normalized1 === 'N/A') {
      return [null, '', 'N/A', undefined].includes(dbSize);
    }
    return normalized1 === normalized2;
  }

  /**
   * Static: Serialize size and quantity for database storage
   */
  static serializeSize(size: string, qty: number): string {
    const normalized = CartItemModel.normalizeSize(size);
    if (normalized === 'N/A') return 'N/A';
    return `${normalized}:${qty}`;
  }

  /**
   * Static: Deserialize size and quantity from database storage
   */
  static deserializeSize(serialized: string | null | undefined): { size: string; quantity: number } {
    if (!serialized || serialized === '' || serialized === 'N/A') {
      return { size: 'N/A', quantity: 0 };
    }
    if (serialized.includes(':')) {
      const [sizePart, qtyPart] = serialized.split(':');
      return { size: sizePart, quantity: parseInt(qtyPart, 10) || 0 };
    }
    return { size: serialized, quantity: 1 };
  }

  /**
   * Static: Create from raw database record
   */
  static fromDatabaseRecord(record: RawCartItemRecord): CartItemModel {
    const rawSize = record.size;
    const rawPetSize = record.pet_size;

    const { size: ownerSize, quantity: deserializedOwnerQty } = CartItemModel.deserializeSize(rawSize);
    const { size: petSize, quantity: deserializedPetQty } = CartItemModel.deserializeSize(rawPetSize);

    const hasOwner = ownerSize !== 'N/A';
    const hasPet = petSize !== 'N/A';

    let ownerQuantity = deserializedOwnerQty;
    let petQuantity = deserializedPetQty;

    // Fallback logic for legacy database rows without quantity suffix in sizes
    if (hasOwner && (!rawSize || !rawSize.includes(':'))) {
      ownerQuantity = record.quantity || 1;
    }
    if (hasPet && (!rawPetSize || !rawPetSize.includes(':'))) {
      petQuantity = record.quantity || 1;
    }

    const sizes = record.product.sizes || [];
    const petSizes = record.product.pet_sizes || [];
    const isMatchingSet = (sizes.length > 0 && petSizes.length > 0) || (hasOwner && hasPet);

    // Combined quantity is the sum
    const quantity = (hasOwner ? ownerQuantity : 0) + (hasPet ? petQuantity : 0);

    const type = isMatchingSet ? "combo" : (hasOwner ? "owner" : "pet");

    let cleanName = record.product.name;
    if (cleanName.endsWith(" (Owner Only)")) cleanName = cleanName.slice(0, -13);
    if (cleanName.endsWith(" (Pet Only)")) cleanName = cleanName.slice(0, -11);

    return new CartItemModel(
      record.product.id,
      cleanName,
      record.product.price,
      record.product.image_url || record.product.images?.[0] || '',
      ownerSize,
      petSize,
      quantity,
      record.product.slug,
      type,
      ownerQuantity,
      petQuantity
    );
  }

  /**
   * Static: Create from plain object
   */
  static fromPlainObject(data: CartItemData): CartItemModel {
    return new CartItemModel(
      data.id,
      data.name,
      data.price,
      data.image,
      data.ownerSize,
      data.petSize,
      data.quantity,
      data.slug,
      data.type,
      data.ownerQuantity,
      data.petQuantity
    );
  }
}

export interface CartItemData {
  id: number | string;
  name: string;
  price: number;
  image: string;
  ownerSize: string;
  petSize: string;
  quantity: number;
  slug: string;
  type: "owner" | "pet" | "combo";
  ownerQuantity: number;
  petQuantity: number;
}

export interface RawCartItemRecord {
  id: string;
  size: string | null;
  pet_size: string | null;
  quantity: number;
  product: {
    id: string;
    name: string;
    price: number;
    image_url: string | null;
    images: string[] | null;
    slug: string;
    sizes?: string[] | null;
    pet_sizes?: string[] | null;
  };
}
