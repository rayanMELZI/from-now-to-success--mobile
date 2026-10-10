import { AuthForm } from "@/components/AuthForm";
import { useAuth } from "@/lib/auth";

export default function RegisterScreen() {
  const { register } = useAuth();
  return (
    <AuthForm
      mode="register"
      onSubmit={({ username, email, password }) => register(username, email, password)}
    />
  );
}
