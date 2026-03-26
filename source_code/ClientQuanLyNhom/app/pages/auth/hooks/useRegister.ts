// src/hooks/useRegister.ts
import { useState } from "react";
import api from "../../../apis/api";
import { toast } from "react-toastify";

type RegisterResponse = {
  message: string;
  success: boolean;
};

export function useRegister() {
  const [loading, setLoading] = useState(false);

  const register = async (
    userName: string,
    fullName: string,
    email: string,
    password: string
  ) => {
    console.log("Hook validation - Input values:", {
      userName,
      fullName,
      email,
      password,
    });

    // Validation cho username
    if (userName.trim() === "") {
      toast.error("Tên đăng nhập không được để trống!");
      throw new Error("Validation failed");
    }
    if (userName.trim().length < 3) {
      toast.error("Tên đăng nhập phải có ít nhất 3 ký tự!");
      throw new Error("Validation failed");
    }
    if (!/^[a-zA-Z0-9_]+$/.test(userName.trim())) {
      toast.error("Tên đăng nhập chỉ được chứa chữ, số hoặc dấu gạch dưới!");
      throw new Error("Validation failed");
    }

    // Validation cho fullname
    if (fullName.trim() === "") {
      console.log("Validation failed: fullname empty");
      toast.error("Họ tên không được để trống!");
      throw new Error("Validation failed");
    }
    if (fullName.trim().length < 2) {
      toast.error("Họ tên phải có ít nhất 2 ký tự!");
      throw new Error("Validation failed");
    }

    // Validation cho email
    if (email.trim() === "") {
      toast.error("Email không được để trống!");
      throw new Error("Validation failed");
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Email không hợp lệ");
      throw new Error("Validation failed");
    }

    // Validation mạnh hơn cho password
    if (password.trim() === "") {
      toast.error("Mật khẩu không được để trống!");
      throw new Error("Validation failed");
    }
    if (password.length < 3) {
      toast.error("Mật khẩu phải có ít nhất 3 ký tự!");
      throw new Error("Validation failed");
    }

    setLoading(true);
    try {
      const res = await api.post("/Auth/register", {
        userName: userName.trim(),
        fullName: fullName.trim(),
        email,
        password,
      });

      if (res?.data?.success === false) {
        toast.error(res.data?.message || "Đăng ký thất bại");
        throw new Error(res.data?.message || "Đăng ký thất bại");
      }

      return res.data;
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.response?.data || "Đăng ký thất bại!");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { register, loading };
}
