/**
 * Warmpawz Design System - Token Exports
 */
export * from './colors';
export * from './typography';
export * from './spacing';
export * from './shadows';
export declare const tokens: {
    readonly colors: {
        readonly primary: {
            readonly DEFAULT: "#FF8C42";
            readonly light: "#FFA366";
            readonly dark: "#FF6B35";
            readonly 50: "#FFF5EE";
            readonly 100: "#FFE8D6";
            readonly 500: "#FF8C42";
            readonly 600: "#FF6B35";
            readonly 700: "#E55A2B";
        };
        readonly pink: {
            readonly DEFAULT: "#FF6B9D";
            readonly light: "#FFD1E3";
            readonly 50: "#FFF0F6";
            readonly 500: "#FF6B9D";
            readonly 600: "#E91E63";
        };
        readonly gray: {
            readonly 50: "#F9FAFB";
            readonly 100: "#F3F4F6";
            readonly 200: "#E5E7EB";
            readonly 300: "#D1D5DB";
            readonly 400: "#9CA3AF";
            readonly 500: "#6B7280";
            readonly 600: "#4B5563";
            readonly 700: "#374151";
            readonly 800: "#1F2937";
            readonly 900: "#111827";
        };
        readonly black: "#000000";
        readonly white: "#FFFFFF";
        readonly service: {
            readonly veterinary: "#26C6DA";
            readonly grooming: "#FF6B9D";
            readonly training: "#9B59B6";
            readonly boarding: "#FF8C42";
            readonly walking: "#4CAF50";
            readonly nutrition: "#FFC857";
            readonly pharmacy: "#2196F3";
            readonly adoption: "#E91E63";
            readonly insurance: "#673AB7";
        };
        readonly blue: {
            readonly DEFAULT: "#2196F3";
            readonly light: "#D9EBFF";
            readonly 50: "#EEF2FF";
            readonly 500: "#2196F3";
            readonly 600: "#1976D2";
        };
        readonly green: {
            readonly DEFAULT: "#4CAF50";
            readonly light: "#EDFFEE";
            readonly 50: "#EDFFEE";
            readonly 500: "#4CAF50";
            readonly 600: "#388E3C";
        };
        readonly purple: {
            readonly DEFAULT: "#9B59B6";
            readonly light: "#F3EAFF";
            readonly 50: "#F3EAFF";
            readonly 500: "#9B59B6";
            readonly 600: "#673AB7";
        };
        readonly teal: {
            readonly DEFAULT: "#26C6DA";
            readonly light: "#E0F7FA";
            readonly 50: "#E0F7FA";
            readonly 500: "#26C6DA";
            readonly 600: "#00ACC1";
        };
        readonly success: "#4CAF50";
        readonly error: "#EF4444";
        readonly warning: "#FFC857";
        readonly info: "#2196F3";
        readonly background: {
            readonly primary: "#FFFFFF";
            readonly secondary: "#F9FAFB";
            readonly tertiary: "#F3F4F6";
        };
        readonly text: {
            readonly primary: "#000000";
            readonly secondary: "#6B7280";
            readonly tertiary: "#9CA3AF";
            readonly inverse: "#FFFFFF";
        };
        readonly border: {
            readonly light: "#E5E7EB";
            readonly DEFAULT: "#D1D5DB";
            readonly dark: "#9CA3AF";
        };
    };
    readonly cssVariables: {
        readonly '--color-primary': "#FF8C42";
        readonly '--color-primary-light': "#FFA366";
        readonly '--color-primary-dark': "#FF6B35";
        readonly '--color-black': "#000000";
        readonly '--color-white': "#FFFFFF";
        readonly '--color-blue': "#2196F3";
        readonly '--color-blue-light': "#D9EBFF";
        readonly '--color-green': "#4CAF50";
        readonly '--color-green-light': "#EDFFEE";
        readonly '--color-purple': "#9B59B6";
        readonly '--color-purple-light': "#F3EAFF";
        readonly '--color-success': "#4CAF50";
        readonly '--color-error': "#EF4444";
        readonly '--color-warning': "#FFC857";
        readonly '--color-info': "#2196F3";
    };
    readonly fontFamily: {
        readonly sans: readonly ["Baloo 2", "system-ui", "sans-serif"];
        readonly mono: readonly ["Fira Code", "monospace"];
    };
    readonly fontWeight: {
        readonly regular: "400";
        readonly medium: "500";
        readonly semibold: "600";
        readonly bold: "700";
        readonly extrabold: "800";
    };
    readonly fontSize: {
        readonly xs: readonly ["12px", {
            readonly lineHeight: "16px";
        }];
        readonly sm: readonly ["14px", {
            readonly lineHeight: "20px";
        }];
        readonly base: readonly ["16px", {
            readonly lineHeight: "24px";
        }];
        readonly lg: readonly ["18px", {
            readonly lineHeight: "28px";
        }];
        readonly xl: readonly ["20px", {
            readonly lineHeight: "28px";
        }];
        readonly '2xl': readonly ["24px", {
            readonly lineHeight: "32px";
        }];
        readonly '3xl': readonly ["30px", {
            readonly lineHeight: "36px";
        }];
        readonly '4xl': readonly ["36px", {
            readonly lineHeight: "40px";
        }];
        readonly '5xl': readonly ["48px", {
            readonly lineHeight: "48px";
        }];
    };
    readonly textStyles: {
        readonly h1: {
            readonly fontFamily: readonly ["Baloo 2", "system-ui", "sans-serif"];
            readonly fontWeight: "800";
            readonly fontSize: "36px";
            readonly lineHeight: "40px";
        };
        readonly h2: {
            readonly fontFamily: readonly ["Baloo 2", "system-ui", "sans-serif"];
            readonly fontWeight: "700";
            readonly fontSize: "30px";
            readonly lineHeight: "36px";
        };
        readonly h3: {
            readonly fontFamily: readonly ["Baloo 2", "system-ui", "sans-serif"];
            readonly fontWeight: "700";
            readonly fontSize: "24px";
            readonly lineHeight: "32px";
        };
        readonly h4: {
            readonly fontFamily: readonly ["Baloo 2", "system-ui", "sans-serif"];
            readonly fontWeight: "600";
            readonly fontSize: "20px";
            readonly lineHeight: "28px";
        };
        readonly h5: {
            readonly fontFamily: readonly ["Baloo 2", "system-ui", "sans-serif"];
            readonly fontWeight: "600";
            readonly fontSize: "18px";
            readonly lineHeight: "28px";
        };
        readonly h6: {
            readonly fontFamily: readonly ["Baloo 2", "system-ui", "sans-serif"];
            readonly fontWeight: "600";
            readonly fontSize: "16px";
            readonly lineHeight: "24px";
        };
        readonly bodyLarge: {
            readonly fontFamily: readonly ["Baloo 2", "system-ui", "sans-serif"];
            readonly fontWeight: "400";
            readonly fontSize: "18px";
            readonly lineHeight: "28px";
        };
        readonly body: {
            readonly fontFamily: readonly ["Baloo 2", "system-ui", "sans-serif"];
            readonly fontWeight: "400";
            readonly fontSize: "16px";
            readonly lineHeight: "24px";
        };
        readonly bodySmall: {
            readonly fontFamily: readonly ["Baloo 2", "system-ui", "sans-serif"];
            readonly fontWeight: "400";
            readonly fontSize: "14px";
            readonly lineHeight: "20px";
        };
        readonly label: {
            readonly fontFamily: readonly ["Baloo 2", "system-ui", "sans-serif"];
            readonly fontWeight: "500";
            readonly fontSize: "14px";
            readonly lineHeight: "20px";
        };
        readonly caption: {
            readonly fontFamily: readonly ["Baloo 2", "system-ui", "sans-serif"];
            readonly fontWeight: "400";
            readonly fontSize: "12px";
            readonly lineHeight: "16px";
        };
        readonly button: {
            readonly fontFamily: readonly ["Baloo 2", "system-ui", "sans-serif"];
            readonly fontWeight: "600";
            readonly fontSize: "16px";
            readonly lineHeight: "24px";
        };
    };
    readonly spacing: {
        readonly 0: "0px";
        readonly px: "1px";
        readonly 0.5: "2px";
        readonly 1: "4px";
        readonly 1.5: "6px";
        readonly 2: "8px";
        readonly 2.5: "10px";
        readonly 3: "12px";
        readonly 3.5: "14px";
        readonly 4: "16px";
        readonly 5: "20px";
        readonly 6: "24px";
        readonly 7: "28px";
        readonly 8: "32px";
        readonly 9: "36px";
        readonly 10: "40px";
        readonly 11: "44px";
        readonly 12: "48px";
        readonly 14: "56px";
        readonly 16: "64px";
        readonly 20: "80px";
        readonly 24: "96px";
        readonly 28: "112px";
        readonly 32: "128px";
    };
    readonly borderRadius: {
        readonly none: "0px";
        readonly sm: "4px";
        readonly DEFAULT: "8px";
        readonly md: "8px";
        readonly lg: "12px";
        readonly xl: "16px";
        readonly '2xl': "24px";
        readonly '3xl': "32px";
        readonly full: "9999px";
    };
    readonly borderWidth: {
        readonly 0: "0px";
        readonly DEFAULT: "1px";
        readonly 2: "2px";
        readonly 4: "4px";
    };
    readonly shadows: {
        readonly none: "none";
        readonly sm: "0 1px 2px 0 rgba(0, 0, 0, 0.05)";
        readonly DEFAULT: "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)";
        readonly md: "0 4px 6px -1px rgba(0, 0, 0, 0.07), 0 2px 4px -2px rgba(0, 0, 0, 0.05)";
        readonly lg: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)";
        readonly xl: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)";
        readonly '2xl': "0 25px 50px -12px rgba(0, 0, 0, 0.25)";
        readonly inner: "inset 0 2px 4px 0 rgba(0, 0, 0, 0.05)";
        readonly primary: "0 4px 14px 0 rgba(255, 140, 66, 0.3)";
        readonly primaryHover: "0 6px 20px 0 rgba(255, 140, 66, 0.4)";
        readonly card: "0 4px 12px 0 rgba(0, 0, 0, 0.08)";
        readonly cardHover: "0 8px 24px 0 rgba(0, 0, 0, 0.12)";
    };
};
export default tokens;
//# sourceMappingURL=index.d.ts.map