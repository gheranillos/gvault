import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="auth-wrap">
      <div className="auth-title">Crear cuenta</div>
      <SignUp />
    </div>
  );
}
