const $$ = (selector) => document.querySelectorAll(selector);
const $ = (selector) => document.querySelector(selector);

$$(".op-card").forEach(label => {
  const input = label.querySelector("input");

  label.addEventListener("click", () => {
    setTimeout(() => {
      label.classList.toggle("selected", input.checked);
    });
  });
});

$$(".level").forEach(button => {
  button.addEventListener("click", () => {
    $$(".level").forEach(btn => btn.classList.remove("active"));
    button.classList.add("active");
  });
});

$("#nextBtn").addEventListener("click", () => {
  const operations = [...$$(".op-card input:checked")].map(input => input.value);
  const difficulty = $(".level.active").dataset.level;

  if (!operations.length) {
    alert("Select at least one operation");
    return;
  }

  localStorage.setItem("operations", JSON.stringify(operations));
  localStorage.setItem("difficulty", difficulty);

  window.location.href = "/teams";
});