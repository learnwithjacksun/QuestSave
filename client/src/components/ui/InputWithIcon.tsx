import { Eye, EyeOff } from "lucide-react"
import { useState, forwardRef } from "react";

const InputWithIcon = forwardRef<HTMLInputElement, InputWithIconProps>(({ icon, label, type, error, ...props }, ref) => {
  const [showPassword, setShowPassword] = useState(false);
  const togglePassword = () => {
    setShowPassword((prev) => !prev);
  }
  return (
    <div className="space-y-2">
        {label && <label htmlFor={props.id} className="text-sm text-muted font-medium">{label}</label>}
        <div className="relative mt-1">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-main/40">
                {icon}
            </div>
            <input ref={ref} {...props} type={type === "password" ? (showPassword ? "text" : "password") : type} className={`pl-12 h-11 w-full rounded-xl text-sm border border-line focus:border-main ${props.className}`} />

              {type === "password" && (
                <div onClick={togglePassword} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted cursor-pointer">
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </div>
            )}
        </div>
        {error && <p className="text-red-500 text-xs font-medium">{error}</p>}
    </div>
  )
})

InputWithIcon.displayName = 'InputWithIcon'

export default InputWithIcon