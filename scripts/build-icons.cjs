const fs = require('fs');
const path = require('path');

const iconMap = {
  home: 'home-line',
  users: 'users-line',
  user: 'user-line',
  beach: 'beach-line',
  receipt: 'receipt-text-line',
  chart: 'presentation-chart-line',
  settings: 'settings-cog-line',
  plus: 'plus-line',
  close: 'close-line',
  search: 'search-line',
  edit: 'edit-pen-2-line',
  delete: 'delete-bin-line',
  check: 'clipboard-check-line',
  lock: 'lock-line',
  unlock: 'unlock-open-line',
  reload: 'reload-line',
  smartphone: 'smartphone-apps-line',
  monitor: 'monitor-line',
  sun: 'lightbulb-shine-line',
  moon: 'moon-line',
  rupee: 'rupee-circle-line',
  dollar: 'dollar-circle-line',
  euro: 'euro-circle-line',
  pound: 'pound-circle-line',
  coins: 'coins-line',
  moneyHand: 'money-hand-line',
  creditcard: 'creditcard-line',
  arrowRight: 'arrow-right-line',
  arrowLeft: 'arrow-left-line',
  chevronRight: 'chevron-right-line',
  chevronDown: 'chevron-down-line',
  chevronLeft: 'chevron-left-line',
  burger: 'burger-line',
  cup: 'cup-line',
  cart: 'shopping-cart-line',
  airplane: 'airplane-line',
  car: 'car-line',
  box: 'box-line',
  lightning: 'lightning-bolt-line',
  ticket: 'ticket-line',
  glass: 'glas-water-line',
  save: 'save-line',
  cloud: 'cloud-line',
  calendar: 'calendar-plus-line',
  filter: 'filter-line',
  heart: 'heart-line',
  folder: 'folder-plus-line',
  share: 'share-line',
  presentationPlay: 'presentation-play-line',
  shield: 'shield-plus-line',
  clipboard: 'clipboard-line',
  arrowUp: 'arrow-up-line',
  arrowDown: 'arrow-down-line',
  alert: 'alert-circle-line',
  info: 'info-circle-line',
  document: 'document-line',
  file: 'file-line',
  eye: 'eye-line',
  eyeOff: 'eye-off-line',
  tag: 'tag-line',
  rocket: 'rocket-3-start-line',
  star: 'shooting-star-line',
  question: 'question-circle-line',
  database: 'data-line',
  play: 'play-circle-line',
  link: 'link-circle-line',
  logout: 'logout-half-circle-line',
  login: 'login-half-circle-line',
  bell: 'bell-line',
  send: 'send-line'
};

const entries = [];
for (const [key, filename] of Object.entries(iconMap)) {
  const filePath = path.join(__dirname, '../node_modules/majesticons/line', filename + '.svg');
  const svg = fs.readFileSync(filePath, 'utf8');
  const inner = svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
  entries.push({ key, inner });
}

let out = "import React from 'react'\n\n";
out += "export type IconName =\n  | " + Object.keys(iconMap).map(k => "'" + k + "'").join("\n  | ") + ";\n\n";

out += `export interface IconProps extends React.SVGProps<SVGSVGElement> {
  name?: IconName
  size?: number | string
  strokeWidth?: number | string
}

const iconPaths: Record<IconName, React.ReactNode> = {
`;

for (const { key, inner } of entries) {
  const jsxInner = inner
    .replace(/stroke-width=/g, 'strokeWidth=')
    .replace(/stroke-linecap=/g, 'strokeLinecap=')
    .replace(/stroke-linejoin=/g, 'strokeLinejoin=')
    .replace(/clip-rule=/g, 'clipRule=')
    .replace(/fill-rule=/g, 'fillRule=');
  out += `  ${key}: (<>${jsxInner}</>),\n`;
}

out += `};

export const Icon: React.FC<IconProps> = ({
  name = 'home',
  size = 20,
  strokeWidth = 2,
  className = '',
  style,
  children,
  ...props
}) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      width={size}
      height={size}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
      {...props}
    >
      {children || (name ? iconPaths[name] : null)}
    </svg>
  );
};

// oxlint-disable-next-line react/only-export-components
export const categoryIconMap: Record<string, IconName> = {
  '🧾': 'receipt',
  '🍔': 'burger',
  '☕': 'cup',
  '🛒': 'cart',
  '✈️': 'airplane',
  '🏨': 'home',
  '🚕': 'car',
  '🍿': 'ticket',
  '🏠': 'home',
  '🎁': 'box',
  '⚡': 'lightning',
  '🍻': 'glass',
  '🏝': 'beach',
  '💞': 'heart',
  '🎉': 'ticket',
  '📁': 'folder',
  '👥': 'users',
  '🤝': 'moneyHand',
  '💳': 'creditcard',
  '📊': 'chart',
  '⚙️': 'settings',
  '🔒': 'lock',
  '🔓': 'unlock',
  '✨': 'presentationPlay',
  '📋': 'clipboard',
  '💾': 'save',
  '📥': 'cloud',
  '🔄': 'reload',
};

// oxlint-disable-next-line react/only-export-components
export const getCategoryIcon = (emojiOrKey: string): IconName => {
  return categoryIconMap[emojiOrKey] || (iconPaths[emojiOrKey as IconName] ? (emojiOrKey as IconName) : 'receipt');
};

export const CategoryIcon: React.FC<{
  category: string
  size?: number | string
  className?: string
}> = ({ category, size = 18, className = '' }) => {
  const iconName = getCategoryIcon(category)
  return <Icon name={iconName} size={size} className={className} />
};
`;

const targetPath = path.join(__dirname, '../src/ui/components/Icon.tsx');
fs.writeFileSync(targetPath, out, 'utf8');
console.log('Successfully generated', targetPath);
