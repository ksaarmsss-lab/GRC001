export const ARMLogo = ({ size = 40, className = "", color = "#10B981" }) => (
  <svg
    viewBox="0 0 60 60"
    width={size}
    height={size}
    className={className}
    data-testid="arm-logo"
    aria-label="Active Risk Management GRC Network"
  >
    <polygon
      points="30,7 53,48 7,48"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinejoin="round"
    />
    {/* GRC — centered inside the triangle (swapped with NW) */}
    <text
      x="30" y="37"
      textAnchor="middle"
      fill={color}
      fontSize="11"
      fontWeight="700"
      fontFamily="Fraunces, serif"
      letterSpacing="0.5"
    >GRC</text>
    {/* NW — along top-left side (swapped with GRC) */}
    <text
      x="14" y="28"
      textAnchor="middle"
      fill={color}
      fontSize="6"
      fontWeight="700"
      fontFamily="'IBM Plex Sans', sans-serif"
      letterSpacing="0.6"
      transform="rotate(-61 14 28)"
    >NW</text>
    {/* AI — along top-right side */}
    <text
      x="46" y="28"
      textAnchor="middle"
      fill={color}
      fontSize="6"
      fontWeight="700"
      fontFamily="'IBM Plex Sans', sans-serif"
      letterSpacing="0.6"
      transform="rotate(61 46 28)"
    >AI</text>
    {/* ARM — along bottom side */}
    <text
      x="30" y="56"
      textAnchor="middle"
      fill={color}
      fontSize="6"
      fontWeight="700"
      fontFamily="'IBM Plex Sans', sans-serif"
      letterSpacing="0.6"
    >ARM</text>
  </svg>
);

export default ARMLogo;
