import { Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { ScrollToTop } from "@/components/ui";
import { Home, Fyp, AvatarSearch, Saves } from "@/pages/main";
import { MainLayout } from "./layouts";

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Toaster position="top-center" richColors />
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Home />} />
          <Route path="saves" element={<Saves />} />
          <Route path="fyp" element={<Fyp />} />
          <Route path="avatar-search" element={<AvatarSearch />} />
        </Route>
      </Routes>
    </>
  );
}
