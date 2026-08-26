import {
  BreadIcon,
  CaffeineFreeIcon,
  CategoryIcon,
  CupIcon,
  DessertIcon,
  FrappuccinoIcon,
  JuiceIcon,
  MealIcon,
  MilkshakeIcon,
  PastryIcon,
  RefresherIcon,
  SnackIcon,
  TeaIcon,
} from './icons'

type IconComponent = (props: { className?: string }) => JSX.Element

// Maps a category's name to its glyph — shared by the admin Categories page
// and the cashier POS department rail so both surfaces label the same
// category with the same icon. Coffee sub-categories (Espresso, Cappuccino,
// etc.) all share the coffee cup glyph — they're drink types within Coffee,
// not separate departments with their own identity.
const CATEGORY_ICONS: Record<string, IconComponent> = {
  coffee: CupIcon,
  bakery: BreadIcon,
  tea: TeaIcon,
  juice: JuiceIcon,
  dessert: DessertIcon,
  snack: SnackIcon,
  meal: MealIcon,
  espresso: CupIcon,
  cappuccino: CupIcon,
  latte: CupIcon,
  mocha: CupIcon,
  macchiato: CupIcon,
  'caffeine-free': CaffeineFreeIcon,
  frappuccino: FrappuccinoIcon,
  milkshake: MilkshakeIcon,
  milkshakes: MilkshakeIcon,
  refresher: RefresherIcon,
  refreshers: RefresherIcon,
  smoothie: MilkshakeIcon,
  smoothies: MilkshakeIcon,
  pastry: PastryIcon,
  pastries: PastryIcon,
}

export function iconForCategory(name: string): IconComponent {
  return CATEGORY_ICONS[name.trim().toLowerCase()] ?? CategoryIcon
}
