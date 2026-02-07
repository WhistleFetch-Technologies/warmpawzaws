#!/bin/bash
# One-time fix so /usr/bin/git works.
# Run: cd /Users/ketan/Documents/warmpawzecodev && ./scripts/fix-git-macos.sh

set -e
CLT=/Library/Developer/CommandLineTools

# If CLT path is missing or invalid, install full Command Line Tools first
if ! test -x "$CLT/usr/bin/git" 2>/dev/null; then
  echo "Command Line Tools are missing or incomplete at $CLT"
  echo ""
  echo "Installing full Command Line Tools (a dialog will open)..."
  xcode-select --install
  echo ""
  echo "After the install finishes, run this script again:"
  echo "  ./scripts/fix-git-macos.sh"
  exit 0
fi

echo "Setting active developer directory to Command Line Tools..."
sudo xcode-select --switch "$CLT"
echo "Done. Test with: git --version"
