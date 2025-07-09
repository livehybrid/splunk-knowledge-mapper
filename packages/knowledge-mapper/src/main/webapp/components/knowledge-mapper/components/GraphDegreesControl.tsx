import React from "react";
import Text from "@splunk/react-ui/Text";

interface GraphDegreesControlProps {
  value: number;
  min?: number;
  max?: number;
  onChange: (val: number) => void;
}

const GraphDegreesControl = ({
  value,
  min = 1,
  max = 5,
  onChange,
}: GraphDegreesControlProps) => (
  <div style={{display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px 0'}}>
    <label htmlFor="degrees-sep">Degrees of Separation:</label>
    <input
      id="degrees-sep"
      type="number"
      value={value}
      min={min}
      max={max}
      step={1}
      style={{width: '80px', padding: '4px', border: '1px solid #ccc', borderRadius: '4px'}}
      onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value))))}
      aria-label="Degrees of Separation"
    />
  </div>
);

export default GraphDegreesControl;
