/* Integration boundary: replace this local adapter with authenticated server requests.
 * A browser-only demo cannot enforce authorization, integrity, or anonymity.
 */
(() => {
  const KEY = "votespace.demo.v1",
    SESSION = "votespace.session.v1";
  const delay = () => new Promise((r) => setTimeout(r, 250));
  const fail = (message) => {
    throw new Error(message);
  };
  const read = () => {
    try {
      const value = JSON.parse(localStorage.getItem(KEY));
      return value?.version === 1 ? value : VoteSpace.seed();
    } catch {
      return VoteSpace.seed();
    }
  };
  const save = (db) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(db));
    } catch {
      fail(
        "Your browser could not save this change. Allow local storage and try again.",
      );
    }
  };
  const user = () => {
    try {
      const s = JSON.parse(sessionStorage.getItem(SESSION));
      if (s && s.expires > Date.now()) return s.user;
      sessionStorage.removeItem(SESSION);
    } catch {
      /* no valid session */
    }
    return null;
  };
  const requireUser = () =>
    user() || fail("Your session has expired. Please sign in again.");
  const admin = () =>
    requireUser().role === "admin" || fail("Administrator access is required.");
  const session = (u) => {
    sessionStorage.setItem(
      SESSION,
      JSON.stringify({ user: u, expires: Date.now() + 60 * 60 * 1000 }),
    );
    return u;
  };
  const hash = async (password, salt) => {
    if (!crypto.subtle)
      fail(
        "Please open VoteSpace through the local server to register an account.",
      );
    const data = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(salt + password),
    );
    return [...new Uint8Array(data)]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  };
  const api = (VoteSpace.api = {
    user,
    async demo(role = "voter") {
      await delay();
      return session({
        id: role === "admin" ? "demo-admin" : "demo-voter",
        name: role === "admin" ? "Alex Morgan" : "Joseph",
        email: role + "@votespace.demo",
        role,
      });
    },
    async login(email, password) {
      await delay();
      const account = read().accounts.find(
        (a) => a.email === email.toLowerCase().trim(),
      );
      if (!account || account.hash !== (await hash(password, account.salt)))
        fail("The email or password is incorrect. Please try again.");
      return session({
        id: account.id,
        name: account.name,
        email: account.email,
        role: "voter",
      });
    },
    async register(name, email, password) {
      await delay();
      const db = read();
      email = email.toLowerCase().trim();
      if (db.accounts.some((a) => a.email === email))
        fail("An account with this email already exists. Please sign in.");
      const salt = crypto.randomUUID();
      const account = {
        id: crypto.randomUUID(),
        name: name.trim(),
        email,
        salt,
        hash: await hash(password, salt),
      };
      db.accounts.push(account);
      save(db);
      return session({
        id: account.id,
        name: account.name,
        email,
        role: "voter",
      });
    },
    logout() {
      sessionStorage.removeItem(SESSION);
    },
    async elections() {
      await delay();
      const u = requireUser();
      return read()
        .elections.filter((e) => u.role === "admin" || e.status !== "draft")
        .map(({ totals, ...e }) => e);
    },
    async election(id) {
      await delay();
      const u = requireUser();
      const e = read().elections.find((e) => e.id === id);
      if (!e) fail("This election could not be found.");
      if (e.status === "draft" && u.role !== "admin")
        fail("This election is not available.");
      const { totals, ...visible } = e;
      return visible;
    },
    async participation(id) {
      const u = requireUser();
      return read().participation[u.id]?.[id] || null;
    },
    async vote(id, candidateId) {
      await delay();
      const u = requireUser();
      if (u.role !== "voter") fail("Use a voter account to cast a ballot.");
      const db = read(),
        e = db.elections.find((e) => e.id === id);
      if (!e || e.status !== "open")
        fail(
          "Voting has closed for this election. Your vote was not submitted.",
        );
      if (db.participation[u.id]?.[id])
        fail("You have already voted in this election.");
      if (!e.candidates.some((c) => c.id === candidateId))
        fail("Please select an available candidate.");
      const receipt = {
        id: "VS-" + crypto.randomUUID().slice(0, 8).toUpperCase(),
        at: new Date().toISOString(),
      };
      e.totals[candidateId] = (e.totals[candidateId] || 0) + 1;
      db.participation[u.id] ||= {};
      db.participation[u.id][id] = receipt;
      save(db);
      return receipt;
    },
    async results(id) {
      await delay();
      requireUser();
      const e = read().elections.find((e) => e.id === id);
      if (!e || e.status !== "closed")
        fail("Results are available only after the election closes.");
      return e;
    },
    async saveElection(input) {
      await delay();
      admin();
      const db = read();
      let e = input.id && db.elections.find((e) => e.id === input.id);
      if (e && e.status !== "draft")
        fail("Only draft elections can be edited.");
      if (!input.title?.trim() || !input.description?.trim())
        fail("Add an election title and description.");
      const fields = {
        title: input.title.trim(),
        description: input.description.trim(),
        position: input.position.trim() || "Campus election",
        date: input.date || "",
      };
      if (e) Object.assign(e, fields);
      else {
        e = {
          ...fields,
          id: crypto.randomUUID(),
          status: "draft",
          candidates: [],
          totals: {},
          color: "blue",
          category: "Campus election",
        };
        db.elections.unshift(e);
      }
      save(db);
      return e;
    },
    async saveCandidate(id, input) {
      await delay();
      admin();
      const db = read(),
        e = db.elections.find((e) => e.id === id);
      if (!e || e.status !== "draft")
        fail("Candidates can only be edited in a draft election.");
      if (!input.name?.trim() || !input.manifesto?.trim())
        fail("Add a name and manifesto.");
      if (input.image && !/^https?:\/\//i.test(input.image))
        fail("Use a valid HTTP or HTTPS image URL.");
      const fields = {
        name: input.name.trim(),
        detail: input.detail.trim(),
        manifesto: input.manifesto.trim(),
        image: input.image.trim(),
        color: "blue",
      };
      const c = e.candidates.find((c) => c.id === input.id);
      if (c) Object.assign(c, fields);
      else e.candidates.push({ ...fields, id: crypto.randomUUID() });
      save(db);
    },
    async removeCandidate(id, candidateId) {
      await delay();
      admin();
      const db = read(),
        e = db.elections.find((e) => e.id === id);
      if (!e || e.status !== "draft")
        fail("Only draft candidates can be removed.");
      e.candidates = e.candidates.filter((c) => c.id !== candidateId);
      save(db);
    },
    async transition(id, status) {
      await delay();
      admin();
      const db = read(),
        e = db.elections.find((e) => e.id === id);
      if (
        !e ||
        !(
          (e.status === "draft" && status === "open") ||
          (e.status === "open" && status === "closed")
        )
      )
        fail("This election status cannot be changed.");
      if (status === "open" && e.candidates.length < 2)
        fail("Add at least two candidates before opening this election.");
      e.status = status;
      if (status === "closed") e.closedAt = new Date().toISOString();
      save(db);
    },
    async removeElection(id) {
      await delay();
      admin();
      const db = read(),
        e = db.elections.find((e) => e.id === id);
      if (
        !e ||
        e.status !== "draft" ||
        Object.values(e.totals).some((n) => n > 0)
      )
        fail("Only draft elections without votes can be deleted.");
      db.elections = db.elections.filter((e) => e.id !== id);
      save(db);
    },
  });
})();
