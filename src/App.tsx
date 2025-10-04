import { useEffect, useRef } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { useAppSelector } from "@/store";
import { Sidebar, Header, Toast } from "./components";
import { closeToast } from "@/features/toastSlice";
import { useAppDispatch } from "@/hooks/useAppDispatch";
import "./App.scss";

export function App() {
  const contentRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const dispatch = useAppDispatch();
  const toast = useAppSelector((state) => state.toast);

  useEffect(() => {
    if (contentRef.current) contentRef.current.scrollTop = 0;
  }, [location.pathname, location.search]);

  const handleCloseToast = () => {
    dispatch(closeToast());
  };

  return (
    <>
      <main>
        <Sidebar />

        <article className="container">
          <Header />

          <section ref={contentRef} className="container__content">
            <Outlet />
          </section>
        </article>
      </main>

      <Toast
        visible={toast.visible}
        title={toast.title}
        message={toast.message}
        type={toast.type}
        duration={toast.duration}
        onClose={handleCloseToast}
      />
    </>
  );
}

