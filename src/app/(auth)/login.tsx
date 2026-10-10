import { AuthForm } from "@/components/AuthForm";
import { useAuth } from "@/lib/auth";

export default function LoginScreen() {
  const { login } = useAuth();
  return <AuthForm mode="login" onSubmit={({ email, password }) => login(email, password)} />;
}
