import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function SignInRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate("/login", { replace: true });
  }, [navigate]);
  return null;
} 