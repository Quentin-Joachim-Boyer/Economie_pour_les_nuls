/* =====================================================================
   Démarrage
   ===================================================================== */
bindPanel();bindTabs();
$('run').addEventListener('click',launch);
sync();syncEps();drawPreviews();renderInventory();launch();
