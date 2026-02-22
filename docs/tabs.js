document.addEventListener('DOMContentLoaded', () => {
  const tabBtns = document.querySelectorAll('.tab-btn');
  const serviceContents = document.querySelectorAll('.service-detail');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.dataset.tab;
      const targetContent = document.getElementById(`${tabId}-content`);

      if (!targetContent) return;

      tabBtns.forEach(b => b.classList.remove('active'));
      serviceContents.forEach(c => c.classList.remove('active'));

      btn.classList.add('active');
      targetContent.classList.add('active');
    });
  });
});
