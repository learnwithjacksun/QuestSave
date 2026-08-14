import { useState } from "react";
import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { toast } from "sonner";
import { requestOtp, verifyOtp } from "@/config/clipApi";
import { getApiError } from "@/config/api";
import useAuthStore from "@/store/useAuthStore";
import { InputWithoutIcon, ButtonWithLoader } from "@/components/ui";
import Icon from "@/components/main/icon";

type Step = "email" | "username" | "otp";

export default function AuthOverlay() {
  const { isOverlayOpen, closeOverlay, setUser } = useAuthStore();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  if (!isOverlayOpen) return null;

  const reset = () => {
    setStep("email");
    setEmail("");
    setUsername("");
    setCode("");
    setLoading(false);
  };

  const handleClose = () => {
    reset();
    closeOverlay();
  };

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await requestOtp(email.trim());
      if (result.needsUsername) {
        setStep("username");
      } else {
        toast.success("Check your email for a sign-in code");
        setStep("otp");
      }
    } catch (error) {
      toast.error(getApiError(error, "Could not send code"));
    } finally {
      setLoading(false);
    }
  };

  const handleUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await requestOtp(email.trim(), username.trim());
      toast.success("Check your email for a sign-in code");
      setStep("otp");
    } catch (error) {
      toast.error(getApiError(error, "Could not send code"));
    } finally {
      setLoading(false);
    }
  };

  const handleOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await verifyOtp(
        email.trim(),
        code.trim(),
        username.trim() || undefined
      );
      setUser(user);
      toast.success(`Welcome, ${user.username}`);
      reset();
      closeOverlay();
    } catch (error) {
      toast.error(getApiError(error, "Could not verify code"));
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-background flex flex-col">
      <button
        type="button"
        onClick={handleClose}
        title="Close"
        className="absolute top-4 right-4 h-10 w-10 rounded-full hover:bg-hover text-main"
      >
        <Icon icon={Cancel01Icon} size={22} />
      </button>

      <div className="flex-1 center px-4">
        <div className="w-full max-w-sm">
          <p className="text-xs uppercase tracking-wide text-primary font-medium mb-2">
            QuestSave
          </p>
          <h1 className="text-2xl font-medium text-main mb-1">
            {step === "email" && "Sign in"}
            {step === "username" && "Choose a username"}
            {step === "otp" && "Enter your code"}
          </h1>
          <p className="text-sm text-muted mb-6">
            {step === "email" && "We’ll email you a one-time code. No password needed."}
            {step === "username" && "This email is new. Pick a username to create your account."}
            {step === "otp" && `We sent a 6-digit code to ${email}.`}
          </p>

          {step === "email" && (
            <form onSubmit={handleEmail} className="space-y-4">
              <InputWithoutIcon
                id="auth-email"
                type="email"
                label="Email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
              />
              <ButtonWithLoader
                type="submit"
                loading={loading}
                initialText="Continue"
                loadingText="Sending..."
                className="btn btn-primary h-11 w-full rounded-xl"
              />
            </form>
          )}

          {step === "username" && (
            <form onSubmit={handleUsername} className="space-y-4">
              <InputWithoutIcon
                id="auth-username"
                type="text"
                label="Username"
                required
                minLength={3}
                maxLength={24}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="yourname"
              />
              <ButtonWithLoader
                type="submit"
                loading={loading}
                initialText="Send code"
                loadingText="Sending..."
                className="btn btn-primary h-11 w-full rounded-xl"
              />
            </form>
          )}

          {step === "otp" && (
            <form onSubmit={handleOtp} className="space-y-4">
              <InputWithoutIcon
                id="auth-otp"
                type="text"
                label="Code"
                required
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="000000"
              />
              <ButtonWithLoader
                type="submit"
                loading={loading}
                initialText="Verify"
                loadingText="Verifying..."
                className="btn btn-primary h-11 w-full rounded-xl"
              />
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
