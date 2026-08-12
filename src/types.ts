export interface Product {
  id: string;
  name: string;
  brand: string;
  price: number;
  originalPrice?: number;
  image: string;
  images?: string[]; // all angles of the item; first = main image
  borderType: 'tribal-aztec' | 'cheetah' | 'fire-neon' | 'skater-checker' | 'retro-wave';
  sizes: string[];
  condition: string;
  category: 'pants' | 'shirts' | 'boardies' | 'accessories' | 'women';
  description: string;
  colors: string[];
  isRare?: boolean;
  isLatestDrop?: boolean;
  isSold?: boolean;
  // Measured on the garment laid flat, in cm. Vintage is one-of-a-kind, so the
  // label size means little — these are what actually answer "will it fit me".
  waistCm?: number;  // across the waistband, edge to edge; circumference is double
  lengthCm?: number; // waistband to hem
  // How many times the item has been opened. Drives the top-wanted rail.
  views?: number;
}

export interface CartItem {
  product: Product;
  selectedSize: string;
  quantity: number;
}

export interface OrderDetails {
  fullName: string;
  phone: string;
  city: string;
  address: string;
  notes?: string;
  shippingMethod: 'home' | 'pickup';
}
