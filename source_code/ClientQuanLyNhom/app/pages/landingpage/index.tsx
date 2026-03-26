import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import styles from "./LandingPage.module.scss";
import logo from "./logo.png";
import slide1 from "./slideshow01.png";
import slide2 from "./slideshow02.png";
import slide3 from "./slideshow03.png";
import aboutImage from "./about.png";
import workflowIllustration from "./workflow.png";
import testimonialsIllustration from "./testimonials.png";
import contactImage from "./contact.png";

const slides = [
  {
    src: slide1,
    title: "Bảng điều khiển trực quan",
    caption:
      "Nắm bắt tình trạng công việc của toàn nhóm chỉ trong một ánh nhìn với dashboard động và realtime.",
  },
  {
    src: slide2,
    title: "Cộng tác tức thời",
    caption:
      "Trao đổi, gán nhiệm vụ và cập nhật tiến độ ngay trên từng thẻ công việc mà không cần rời khỏi ứng dụng.",
  },
  {
    src: slide3,
    title: "Quy trình tối ưu",
    caption:
      "Tùy chỉnh quy trình, tự động hóa nhắc hạn để đảm bảo mọi dự án về đích đúng kế hoạch.",
  },
];

const stats = [
  { value: "120+", label: "Doanh nghiệp tin dùng" },
  { value: "8.5k", label: "Công việc xử lý mỗi tuần" },
  { value: "4.9/5", label: "Mức độ hài lòng trung bình" },
];

const workflowSteps = [
  {
    title: "Khởi tạo và phân quyền",
    description:
      "Tạo nhóm trong vài giây, mời thành viên và cấp quyền truy cập phù hợp với vai trò cụ thể.",
  },
  {
    title: "Lên kế hoạch chiến lược",
    description:
      "Tổ chức nhiệm vụ bằng bảng Kanban, thiết lập mốc thời gian và mức độ ưu tiên rõ ràng.",
  },
  {
    title: "Theo dõi và tối ưu",
    description:
      "Nhận cảnh báo sớm, báo cáo trực quan giúp tối ưu nguồn lực và đảm bảo tiến độ dự án.",
  },
];

const testimonials = [
  {
    quote:
      "CyberTeamWork giúp đội ngũ marketing của chúng tôi đồng bộ nhiệm vụ và phản hồi khách hàng nhanh gấp đôi.",
    name: "Nguyễn Thảo",
    role: "Marketing Lead - ST United",
  },
  {
    quote:
      "Nhờ hệ thống phân quyền rõ ràng, việc quản trị dự án IT quy mô lớn trở nên nhẹ nhàng hơn rất nhiều.",
    name: "Lê Hoàng",
    role: "Project Manager - NextGen Lab",
  },
  {
    quote:
      "Chúng tôi đặc biệt ấn tượng với khả năng báo cáo realtime và các nhắc nhở deadline thông minh.",
    name: "Phạm An",
    role: "COO - Aurora Studio",
  },
];

const sectionsOrder = ["home", "stats", "about", "workflow", "testimonials", "contact"] as const;

const navItems: { id: (typeof sectionsOrder)[number]; label: string }[] = [
  { id: "home", label: "Home" },
  { id: "about", label: "About" },
  { id: "workflow", label: "Workflow" },
  { id: "testimonials", label: "Testimonials" },
  { id: "contact", label: "Contact" },
];

const LandingPage = () => {
  const [activeSlide, setActiveSlide] = useState(0);
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);
  const [activeSectionIndex, setActiveSectionIndex] = useState(0);
  const [visibleSections, setVisibleSections] = useState<string[]>(["home"]);
  const inactivityTimerRef = useRef<number | null>(null);
  const scrollAnimationRef = useRef<number | null>(null);

  const visibleSectionsSet = useMemo(() => new Set(visibleSections), [visibleSections]);

  const smoothScrollTo = useCallback((targetY: number, duration = 1400) => {
    if (scrollAnimationRef.current) {
      window.cancelAnimationFrame(scrollAnimationRef.current);
    }

    const startY = window.scrollY || window.pageYOffset;
    const distance = targetY - startY;
    const startTime = performance.now();

    const easeInOutCubic = (t: number) =>
      t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    const step = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeInOutCubic(progress);
      window.scrollTo({ top: startY + distance * eased, left: 0 });

      if (progress < 1) {
        scrollAnimationRef.current = window.requestAnimationFrame(step);
      }
    };

    scrollAnimationRef.current = window.requestAnimationFrame(step);
  }, []);

  const resetAutoScroll = useCallback(() => {
    setAutoScrollEnabled(false);
    if (inactivityTimerRef.current) {
      window.clearTimeout(inactivityTimerRef.current);
    }
    inactivityTimerRef.current = window.setTimeout(() => {
      setAutoScrollEnabled(true);
    }, 8000);
  }, []);

  const handleScrollToSection = useCallback(
    (sectionId: string) => {
      const nextIndex = sectionsOrder.findIndex((id) => id === sectionId);
      if (nextIndex === -1) {
        return;
      }
      resetAutoScroll();
      setActiveSectionIndex(nextIndex);
      const sectionElement = document.getElementById(sectionId);
      if (sectionElement) {
        const top =
          window.scrollY + sectionElement.getBoundingClientRect().top - 80;
        smoothScrollTo(top < 0 ? 0 : top);
      }
    },
    [resetAutoScroll, smoothScrollTo]
  );

  useEffect(() => {
    const resetInactivity = () => {
      resetAutoScroll();
    };

    window.addEventListener("wheel", resetInactivity, { passive: true });
    window.addEventListener("touchstart", resetInactivity, { passive: true });
    window.addEventListener("keydown", resetInactivity);

    return () => {
      window.removeEventListener("wheel", resetInactivity);
      window.removeEventListener("touchstart", resetInactivity);
      window.removeEventListener("keydown", resetInactivity);
      if (inactivityTimerRef.current) {
        window.clearTimeout(inactivityTimerRef.current);
      }
    };
  }, [resetAutoScroll]);

  useEffect(() => {
    const timer = window.setInterval(
      () => setActiveSlide((prev) => (prev + 1) % slides.length),
      6000
    );

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!autoScrollEnabled) return;

    const timer = window.setInterval(() => {
      setActiveSectionIndex((prev) => {
        const nextIndex = (prev + 1) % sectionsOrder.length;
        const sectionId = sectionsOrder[nextIndex];
        const sectionElement = document.getElementById(sectionId);
        if (sectionElement) {
          const top =
            window.scrollY + sectionElement.getBoundingClientRect().top - 80;
          smoothScrollTo(top < 0 ? 0 : top);
        }
        return nextIndex;
      });
    }, 12000);

    return () => window.clearInterval(timer);
  }, [autoScrollEnabled, smoothScrollTo]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const sectionId = entry.target.getAttribute("id");
          if (!sectionId) return;

          setVisibleSections((prev) => (prev.includes(sectionId) ? prev : [...prev, sectionId]));

          const sectionIndex = sectionsOrder.findIndex((id) => id === sectionId);
          if (sectionIndex !== -1) {
            setActiveSectionIndex(sectionIndex);
          }
        });
      },
      { threshold: 0.35 }
    );

    sectionsOrder.forEach((id) => {
      const element = document.getElementById(id);
      if (element) {
        observer.observe(element);
      }
    });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    return () => {
      if (scrollAnimationRef.current) {
        window.cancelAnimationFrame(scrollAnimationRef.current);
      }
    };
  }, []);

  return (
    <div className={styles.pageWrapper}>
      <header className={styles.header}>
        <div className={styles.logoWrap}>
          <img src={logo} alt="CyberTeamWork logo" />
          <span>CyberTeamWork</span>
        </div>
        <nav className={styles.nav}>
          {navItems.map((item) => {
            const targetIndex = sectionsOrder.findIndex((id) => id === item.id);
            const isActive = targetIndex === activeSectionIndex;
            return (
              <a
                key={item.id}
                href={`#${item.id}`}
                onClick={(event) => {
                  event.preventDefault();
                  handleScrollToSection(item.id);
                }}
                className={isActive ? styles.navLinkActive : undefined}
              >
                {item.label}
              </a>
            );
          })}
        </nav>
        <div className={styles.authActions}>
          <Link to="/app" className={styles.launchBtn}>
            Vào ứng dụng
          </Link>
        </div>
      </header>

      <main className={styles.mainContent}>
        <section
          id="home"
          className={`${styles.section} ${styles.heroSection} ${visibleSectionsSet.has("home") ? styles.sectionVisible : ""}`.trim()}
        >
          <div className={styles.heroCopy}>
            <h1>Quản lý nhóm thông minh cùng CyberTeamWork</h1>
            <p>
              Theo dõi tiến độ, phân công nhiệm vụ và cộng tác hiệu quả với giải pháp quản lý công việc
              dành cho các đội nhóm hiện đại.
            </p>
            <div className={styles.heroActions}>
              <Link to="/app" className={styles.primaryCta}>
                Bắt đầu ngay
              </Link>
              <a
                href="#about"
                className={styles.secondaryCta}
                onClick={(event) => {
                  event.preventDefault();
                  handleScrollToSection("about");
                }}
              >
                Tìm hiểu thêm
              </a>
            </div>
          </div>
          <div className={styles.heroSlideshow}>
            <div className={styles.slideViewport}>
              {slides.map((slide, index) => (
                <figure
                  key={slide.title}
                  className={`${styles.slide} ${index === activeSlide ? styles.slideActive : ""}`.trim()}
                >
                  <img src={slide.src} alt={slide.title} />
                  <figcaption>
                    <strong>{slide.title}</strong>
                    <span>{slide.caption}</span>
                  </figcaption>
                </figure>
              ))}
            </div>
            <div className={styles.slideDots}>
              {slides.map((_, index) => (
                <button
                  key={`slide-dot-${index}`}
                  type="button"
                  aria-label={`Xem slide ${index + 1}`}
                  className={index === activeSlide ? styles.dotActive : ""}
                  onClick={() => setActiveSlide(index)}
                />
              ))}
            </div>
          </div>
        </section>

        <section
          id="stats"
          className={`${styles.section} ${styles.statsSection} ${visibleSectionsSet.has("stats") ? styles.sectionVisible : ""}`.trim()}
        >
          <div className={styles.statsGrid}>
            {stats.map((stat) => (
              <div key={stat.label} className={styles.statCard}>
                <strong>{stat.value}</strong>
                <span>{stat.label}</span>
              </div>
            ))}
          </div>
        </section>

        <section
          id="about"
          className={`${styles.section} ${styles.splitSection} ${visibleSectionsSet.has("about") ? styles.sectionVisible : ""}`.trim()}
        >
          <div className={styles.sectionMedia}>
            <img src={aboutImage} alt="CyberTeamWork About" />
          </div>
          <div className={styles.sectionHeading}>
            <span>Vì sao chọn chúng tôi</span>
            <h2>Giải pháp đồng hành cùng mọi đội nhóm</h2>
            <p>
              CyberTeamWork giúp bạn tổ chức công việc tinh gọn, minh bạch với hệ thống bảng Kanban, báo cáo và
              phân quyền linh hoạt.
            </p>
            <div className={styles.featuresGrid}>
              <article className={styles.featureCard}>
                <h3>Nhìn tổng quan rõ ràng</h3>
                <p>
                  Mọi công việc, tiến độ và trách nhiệm được hiển thị trực quan, giúp bạn quản lý dễ dàng.
                </p>
              </article>
              <article className={styles.featureCard}>
                <h3>Tự động hóa luồng việc</h3>
                <p>
                  Thiết lập quy trình riêng, nhắc nhở tự động để giảm thiểu sai sót và trễ hạn.
                </p>
              </article>
              <article className={styles.featureCard}>
                <h3>Kết nối đa nền tảng</h3>
                <p>
                  Làm việc mọi lúc mọi nơi với phiên bản web tối ưu cho cả máy tính và thiết bị di động.
                </p>
              </article>
            </div>
          </div>
        </section>

        <section
          id="workflow"
          className={`${styles.section} ${styles.workflowSection} ${styles.splitSection} ${visibleSectionsSet.has("workflow") ? styles.sectionVisible : ""}`.trim()}
        >
          <div className={styles.sectionHeading}>
            <span>Quy trình làm việc</span>
            <h2>Dẫn dắt dự án từ ý tưởng đến hoàn thành</h2>
            <p>
              Mỗi bước đều được chuẩn hóa với checklist rõ ràng, giúp cả nhóm phối hợp nhịp nhàng và hạn chế sai sót.
            </p>
            <ol className={styles.workflowTimeline}>
              {workflowSteps.map((step, index) => (
                <li key={step.title} className={styles.workflowStep}>
                  <div className={styles.workflowIndex}>{String(index + 1).padStart(2, "0")}</div>
                  <div>
                    <h3>{step.title}</h3>
                    <p>{step.description}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <div className={styles.sectionMedia}>
            <img src={workflowIllustration} alt="CyberTeamWork Workflow" />
          </div>
        </section>

        <section
          id="testimonials"
          className={`${styles.section} ${styles.testimonialSection} ${styles.splitSection} ${visibleSectionsSet.has("testimonials") ? styles.sectionVisible : ""}`.trim()}
        >
          <div className={styles.sectionMedia}>
            <img src={testimonialsIllustration} alt="Khách hàng CyberTeamWork" />
          </div>
          <div className={styles.sectionHeading}>
            <span>Khách hàng nói gì</span>
            <h2>Niềm tin từ các đội nhóm dẫn đầu</h2>
            <p>
              CyberTeamWork được thiết kế cùng các chuyên gia quản lý dự án để mang lại trải nghiệm tốt nhất cho mọi
              ngành nghề.
            </p>
            <div className={styles.testimonialGrid}>
              {testimonials.map((item) => (
                <article key={item.name} className={styles.testimonialCard}>
                  <p>“{item.quote}”</p>
                  <footer>
                    <strong>{item.name}</strong>
                    <span>{item.role}</span>
                  </footer>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section
          className={`${styles.section} ${styles.ctaRibbon} ${visibleSectionsSet.has("testimonials") ? styles.sectionVisible : ""}`.trim()}
        >
          <div className={styles.ctaContent}>
            <h2>Chuẩn hóa quy trình làm việc của đội bạn ngay hôm nay</h2>
            <p>
              Trải nghiệm miễn phí 14 ngày để khám phá toàn bộ tính năng quản lý dự án, phân công và báo cáo thông minh.
            </p>
            <div className={styles.heroActions}>
              <Link to="/app" className={styles.primaryCta}>
                Trải nghiệm miễn phí
              </Link>
              <a
                href="#contact"
                className={styles.secondaryCta}
                onClick={(event) => {
                  event.preventDefault();
                  handleScrollToSection("contact");
                }}
              >
                Đặt lịch demo
              </a>
            </div>
          </div>
        </section>

        <section
          id="contact"
          className={`${styles.section} ${styles.contactSection} ${styles.splitSection} ${visibleSectionsSet.has("contact") ? styles.sectionVisible : ""}`.trim()}
        >
          <div className={styles.sectionHeading}>
            <span>Liên hệ</span>
            <h2>Kết nối với CyberTeamWork</h2>
            <p>
              Hãy để lại thông tin, đội ngũ của chúng tôi sẽ tư vấn giải pháp phù hợp cho nhóm của bạn.
            </p>
            <form className={styles.contactForm}>
              <div className={styles.formRow}>
                <label htmlFor="name">Tên của bạn</label>
                <input id="name" name="name" type="text" placeholder="Nguyễn Văn A" required />
              </div>
              <div className={styles.formRow}>
                <label htmlFor="email">Email</label>
                <input id="email" name="email" type="email" placeholder="email@company.com" required />
              </div>
              <div className={styles.formRow}>
                <label htmlFor="message">Nội dung</label>
                <textarea
                  id="message"
                  name="message"
                  placeholder="Bạn đang tìm kiếm giải pháp nào?"
                  rows={4}
                  required
                />
              </div>
              <button type="submit" className={styles.submitBtn}>
                Gửi thông tin
              </button>
            </form>
          </div>
          <div className={styles.sectionMedia}>
            <img src={contactImage} alt="Liên hệ CyberTeamWork" />
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerContent}>
          <div className={styles.footerBrand}>
            <img src={logo} alt="CyberTeamWork" />
            <p>
              CyberTeamWork - Nền tảng quản lý công việc nhóm giúp kết nối con người và công việc.
            </p>
          </div>
          <div className={styles.footerLinks}>
            <a href="#home">Home</a>
            <a href="#about">About</a>
            <a href="#workflow">Workflow</a>
            <a href="#testimonials">Testimonials</a>
            <a href="#contact">Contact</a>
            <Link to="/app">Ứng dụng</Link>
          </div>
          <div className={styles.footerMeta}>
            <p>Email: support@cyberteamwork.com</p>
            <p>Hotline: 1900 1234</p>
          </div>
        </div>
        <p className={styles.copyright}>
          © {new Date().getFullYear()} CyberTeamWork. All rights reserved.
        </p>
      </footer>
    </div>
  );
};

export default LandingPage;
