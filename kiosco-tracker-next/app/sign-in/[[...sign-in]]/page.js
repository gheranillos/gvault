import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="auth-wrap">
      <div className="auth-title">Iniciar sesion</div>
      <SignIn />
    </div>
  );
}
