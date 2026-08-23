// ============================================
// CareerAI - Core Utilities
// ============================================

const API = {
  BASE: (() => {
    const hostname = window.location.hostname;
    const port = window.location.port;

    // Local development using VS Code Live Server
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      if (port === "5500" || port === "5501") {
        return "http://localhost:5000/api";
      }
    }

    // Production frontend on Netlify
    return "https://career-guidance-1-zb06.onrender.com/api";
  })(),

  async request(method, path, data, token) {
    const opts = {
      method,
      headers: { "Content-Type": "application/json" },
    };
    if (token || Auth.token())
      opts.headers["Authorization"] = `Bearer ${token || Auth.token()}`;
    if (data) opts.body = JSON.stringify(data);
    const r = await fetch(this.BASE + path, opts);
    const json = await r.json();
    if (!r.ok) throw new Error(json.error || "Request failed");
    return json;
  },

  get: (path) => API.request("GET", path),
  post: (path, data) => API.request("POST", path, data),
  put: (path, data) => API.request("PUT", path, data),
};

const Auth = {
  token: () => localStorage.getItem("car_token"),
  user: () => {
    try {
      return JSON.parse(localStorage.getItem("car_user"));
    } catch {
      return null;
    }
  },
  set: (token, user) => {
    localStorage.setItem("car_token", token);
    localStorage.setItem("car_user", JSON.stringify(user));
  },
  clear: () => {
    localStorage.removeItem("car_token");
    localStorage.removeItem("car_user");
  },
  check: () => {
    if (!Auth.token()) {
      window.location.href = "login.html";
      return false;
    }
    return true;
  },
  logout: () => {
    Auth.clear();
    window.location.href = "index.html";
  },
};

// Toast notifications
const Toast = {
  container: null,
  init() {
    this.container = document.getElementById("toastContainer");
    if (!this.container) {
      this.container = document.createElement("div");
      this.container.className = "toast-container";
      this.container.id = "toastContainer";
      document.body.appendChild(this.container);
    }
  },
  show(message, type = "info", duration = 3500) {
    if (!this.container) this.init();
    const icons = { success: "✅", error: "❌", info: "💡", warning: "⚠️" };
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${icons[type] || "💡"}</span><span>${message}</span>`;
    this.container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateX(30px)";
      toast.style.transition = "all 0.3s ease";
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },
  success: (m) => Toast.show(m, "success"),
  error: (m) => Toast.show(m, "error"),
  info: (m) => Toast.show(m, "info"),
};

// Animate counter
function animateCounter(el, target, duration = 2000, suffix = "") {
  let start = 0;
  const step = (timestamp) => {
    if (!start) start = timestamp;
    const progress = Math.min((timestamp - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.floor(eased * target) + suffix;
    if (progress < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// Intersection observer for animations
function observeElements(selector, callback, threshold = 0.2) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          callback(entry.target);
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold },
  );
  document.querySelectorAll(selector).forEach((el) => observer.observe(el));
  return observer;
}

// Animate progress bars
function animateProgressBars() {
  observeElements(".progress-fill", (el) => {
    const target = el.getAttribute("data-width") || el.style.width;
    el.style.width = "0%";
    setTimeout(() => {
      el.style.width = target;
    }, 100);
  });
}

// Animate score circles
function animateScoreCircle(circle, value) {
  const fill = circle.querySelector(".score-circle-fill");
  const valueEl = circle.querySelector(".score-circle-value");
  if (!fill) return;
  const circumference = 283;
  const offset = circumference - (value / 100) * circumference;
  fill.style.strokeDashoffset = circumference;
  setTimeout(() => {
    fill.style.strokeDashoffset = offset;
    if (valueEl) animateCounter(valueEl, value, 1500, "%");
  }, 100);
}

// Particles system
function initParticles(canvas) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  let particles = [];
  let animId;

  const resize = () => {
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
  };
  resize();
  window.addEventListener("resize", resize);

  const colors = [
    "rgba(108,99,255,0.6)",
    "rgba(0,229,255,0.4)",
    "rgba(139,92,246,0.5)",
  ];

  class Particle {
    constructor() {
      this.reset();
    }
    reset() {
      this.x = Math.random() * canvas.width;
      this.y = Math.random() * canvas.height;
      this.size = Math.random() * 2 + 0.5;
      this.speedX = (Math.random() - 0.5) * 0.4;
      this.speedY = (Math.random() - 0.5) * 0.4;
      this.color = colors[Math.floor(Math.random() * colors.length)];
      this.opacity = Math.random() * 0.6 + 0.2;
    }
    update() {
      this.x += this.speedX;
      this.y += this.speedY;
      if (
        this.x < 0 ||
        this.x > canvas.width ||
        this.y < 0 ||
        this.y > canvas.height
      )
        this.reset();
    }
    draw() {
      ctx.globalAlpha = this.opacity;
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  const count = Math.min(80, Math.floor((canvas.width * canvas.height) / 8000));
  for (let i = 0; i < count; i++) particles.push(new Particle());

  const animate = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach((p) => {
      p.update();
      p.draw();
    });
    // Draw connections
    particles.forEach((p, i) => {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = p.x - particles[j].x;
        const dy = p.y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 100) {
          ctx.globalAlpha = (1 - dist / 100) * 0.15;
          ctx.strokeStyle = "rgba(108,99,255,0.8)";
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
      }
    });
    animId = requestAnimationFrame(animate);
  };
  animate();

  return () => {
    cancelAnimationFrame(animId);
    window.removeEventListener("resize", resize);
  };
}

// Navbar scroll behavior
function initNavbar() {
  const navbar = document.querySelector(".navbar");
  if (!navbar) return;
  window.addEventListener(
    "scroll",
    () => {
      navbar.classList.toggle("scrolled", window.scrollY > 50);
    },
    { passive: true },
  );
}

// FAQ accordion
function initFAQ() {
  document.querySelectorAll(".faq-question").forEach((q) => {
    q.addEventListener("click", () => {
      const item = q.closest(".faq-item");
      const isOpen = item.classList.contains("open");
      document
        .querySelectorAll(".faq-item")
        .forEach((i) => i.classList.remove("open"));
      if (!isOpen) item.classList.add("open");
    });
  });
}

// Mobile drawer
function initMobileDrawer() {
  const hamburger = document.getElementById("hamburger");
  const drawer = document.getElementById("mobileDrawer");
  const overlay = drawer?.querySelector(".drawer-overlay");
  const closeBtn = document.getElementById("closeDrawer");

  hamburger?.addEventListener("click", () => drawer?.classList.add("open"));
  overlay?.addEventListener("click", () => drawer?.classList.remove("open"));
  closeBtn?.addEventListener("click", () => drawer?.classList.remove("open"));
}

// Sidebar active link
function initSidebarActive() {
  const path = window.location.pathname;
  document
    .querySelectorAll(".sidebar-link, .mobile-nav-item")
    .forEach((link) => {
      const href = link.getAttribute("href");
      if (
        href === path ||
        (path === "/" && href === "/") ||
        (path !== "/" && href !== "/" && path.startsWith(href))
      ) {
        link.classList.add("active");
      }
    });
}

// Format date
function timeAgo(date) {
  const d = new Date(date);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// Page loader
function hideLoader() {
  const loader = document.getElementById("pageLoader");
  if (loader) {
    setTimeout(() => loader.classList.add("hidden"), 800);
  }
}

// Initialize AOS-like scroll reveal
function initScrollReveal() {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.style.opacity = "1";
          entry.target.style.transform = "translateY(0)";
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1 },
  );

  document.querySelectorAll("[data-reveal]").forEach((el) => {
    el.style.opacity = "0";
    el.style.transform = "translateY(30px)";
    el.style.transition = `opacity 0.6s ease ${el.dataset.delay || "0"}s, transform 0.6s ease ${el.dataset.delay || "0"}s`;
    observer.observe(el);
  });
}

// Global AI Mentor FAB
const MentorFAB = {
  history: [],
  isOpen: false,

  init() {
    const fab = document.getElementById("mentorFab");
    const panel = document.getElementById("mentorPanel");
    const input = document.getElementById("fabInput");
    const sendBtn = document.getElementById("fabSend");

    if (!fab) return;

    fab.addEventListener("click", () => {
      this.isOpen = !this.isOpen;
      panel.classList.toggle("open", this.isOpen);
      fab.textContent = this.isOpen ? "✕" : "🤖";
      if (this.isOpen && this.history.length === 0) {
        this.addMessage(
          "ai",
          "Hi! I'm your AI Career Mentor 🚀 Ask me anything about your career, skills, or interview prep!",
        );
      }
    });

    sendBtn?.addEventListener("click", () => this.send(input));
    input?.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        this.send(input);
      }
    });
  },

  addMessage(role, content) {
    const msgs = document.getElementById("fabMessages");
    if (!msgs) return;
    const div = document.createElement("div");
    div.className = `fab-msg ${role}`;
    div.textContent = content;
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
    this.history.push({ role, content });
  },

  async send(input) {
    const msg = input?.value?.trim();
    if (!msg) return;
    input.value = "";
    this.addMessage("user", msg);

    const token = Auth.token();
    if (!token) {
      this.addMessage("ai", "Please log in to chat with your AI mentor!");
      return;
    }

    try {
      const r = await fetch(`${API.BASE}/ai/mentor`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: msg, history: this.history.slice(-6) }),
      });
      const data = await r.json();
      this.addMessage("ai", data.response || "Let me think about that...");
    } catch {
      this.addMessage(
        "ai",
        "I'm having trouble connecting right now. Please try again!",
      );
    }
  },
};

// Init on DOM ready
document.addEventListener("DOMContentLoaded", () => {
  hideLoader();
  initNavbar();
  initFAQ();
  initMobileDrawer();
  initSidebarActive();
  initScrollReveal();
  MentorFAB.init();
  Toast.init();

  // Add user info to nav if logged in
  const user = Auth.user();
  const userNameEl = document.getElementById("navUserName");
  const userBadge = document.getElementById("navUserBadge");
  if (user) {
    if (userNameEl) userNameEl.textContent = user.name?.split(" ")[0];
    if (userBadge) userBadge.style.display = "flex";
    document
      .querySelectorAll(".nav-user-name")
      .forEach((el) => (el.textContent = user.name?.split(" ")[0]));
  }

  // Logout handlers
  document.querySelectorAll("[data-logout]").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      Auth.logout();
    });
  });
});

// Export for modules
window.API = API;
window.Auth = Auth;
window.Toast = Toast;
window.animateCounter = animateCounter;
window.animateProgressBars = animateProgressBars;
window.animateScoreCircle = animateScoreCircle;
window.observeElements = observeElements;
window.initParticles = initParticles;
window.timeAgo = timeAgo;
