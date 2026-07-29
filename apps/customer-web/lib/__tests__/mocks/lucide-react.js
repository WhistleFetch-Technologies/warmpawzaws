/** Jest stub — lucide-react ships ESM; avoid parsing icon modules in unit tests. */
const React = require('react');

const MockIcon = React.forwardRef(function LucideMockIcon(props, ref) {
  return React.createElement('svg', { ref, ...props });
});

module.exports = new Proxy(
  { __esModule: true, default: MockIcon },
  {
    get(target, prop) {
      if (prop in target) return target[prop];
      return MockIcon;
    },
  }
);
