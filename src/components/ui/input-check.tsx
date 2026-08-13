import { AnimatePresence, motion } from "framer-motion";
import { Check } from "lucide-react";
import clsx from "clsx";

interface InputCheckProps extends React.InputHTMLAttributes<HTMLInputElement> {
  checked: boolean;
  size?: number;
  checkSize?: number;
  radius?: number;
  accent?: string; // Tailwind background class
  borderColor?: string; // Tailwind border class
}

export default function InputCheck({
  checked,
  size = 20,
  checkSize = 14,
  radius = 6,
  accent = "bg-primary",
  borderColor = "border-line",
  ...props
}: InputCheckProps) {
  return (
    <div>
      <label
        htmlFor={props.id}
        className="relative flex items-center justify-center"
      >
        <input
          type="checkbox"
          {...props}
          checked={checked}
          className={clsx(
            "appearance-none input border rounded-md transition-colors duration-200",
            borderColor,
            checked && accent,
            checked && "border-transparent",

          )}
          style={{
            width: size,
            height: size,
            borderRadius: radius,
          }}
        />
        <AnimatePresence mode="wait">
          {checked && (
            <motion.div
              key="check"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute text-white pointer-events-none"
            >
              <Check size={checkSize} strokeWidth={3} />
            </motion.div>
          )}
        </AnimatePresence>
      </label>
    </div>
  );
}
