const MODULE_ID = "custom-initiative-swade";
const FLAG_SCOPE = MODULE_ID;

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, "formula", {
    name: "Fórmula global de iniciativa",
    hint: "Fórmula do Foundry Roll. Pode usar @variaveis disponíveis em Actor.getRollData(). Exemplo ilustrativo: 1d20 + @attributes.agility.die",
    scope: "world",
    config: false,
    type: String,
    default: "1d20"
  });

  game.settings.register(MODULE_ID, "showRollMessages", {
    name: "Publicar resultados no chat",
    hint: "Cria uma mensagem resumida no chat após a rolagem de iniciativa.",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });
});

Hooks.once("ready", () => {
  if (game.system.id !== "swade") {
    ui.notifications.warn("Custom Initiative foi projetado para SWADE. O módulo não foi ativado neste sistema.");
    return;
  }

  installInitiativeOverride();
  Hooks.on("renderCombatTracker", addTrackerControls);
  console.info(`${MODULE_ID} | módulo carregado.`);
});

function installInitiativeOverride() {
  const CombatClass = CONFIG.Combat?.documentClass ?? globalThis.Combat;
  if (!CombatClass?.prototype) {
    console.error(`${MODULE_ID} | Não foi possível localizar a classe Combat.`);
    ui.notifications.error("Custom Initiative: não foi possível integrar com o Combat Tracker.");
    return;
  }

  // Substitui o método usado pelo fluxo normal do Combat Tracker.
  // O método original do SWADE não é chamado, evitando a distribuição de cartas.
  CombatClass.prototype.rollInitiative = async function (ids, options = {}) {
    return rollCustomInitiative(this, ids, options);
  };

  console.info(`${MODULE_ID} | Combat.rollInitiative substituído pela rolagem personalizada.`);
}

async function rollCustomInitiative(combat, ids, options = {}) {
  if (!game.user.isGM) {
    ui.notifications.warn("Somente o Mestre pode executar a rolagem personalizada de iniciativa.");
    return combat;
  }

  const requestedIds = ids == null
    ? combat.combatants.map(c => c.id)
    : (Array.isArray(ids) ? ids : [ids]);

  const combatants = requestedIds
    .map(id => combat.combatants.get(id))
    .filter(Boolean);

  if (!combatants.length) {
    ui.notifications.info("Não há combatentes selecionados para rolar iniciativa.");
    return combat;
  }

  const baseFormula = String(game.settings.get(MODULE_ID, "formula") ?? "").trim();
  if (!baseFormula) {
    ui.notifications.error("A fórmula global está vazia. Configure-a antes de rolar iniciativa.");
    return combat;
  }

  const results = [];
  for (const combatant of combatants) {
    const actor = combatant.actor;
    if (!actor) continue;

    const modifier = Number(combatant.getFlag(FLAG_SCOPE, "modifier") ?? 0);
    const safeModifier = Number.isFinite(modifier) ? modifier : 0;
    const formula = safeModifier === 0
      ? `(${baseFormula})`
      : `((${baseFormula}) + (${safeModifier}))`;

    try {
      const rollData = actor.getRollData?.() ?? {};
      const roll = await (new Roll(formula, rollData)).evaluate();
      const total = Number(roll.total);

      if (!Number.isFinite(total)) {
        throw new Error("A fórmula não produziu um resultado numérico.");
      }

      await combat.setInitiative(combatant.id, total);
      results.push({ name: combatant.name, total, formula, roll });
    } catch (error) {
      console.error(`${MODULE_ID} | Erro ao rolar iniciativa de ${combatant.name}:`, error);
      ui.notifications.error(`Falha na iniciativa de ${combatant.name}: ${error.message}`);
    }
  }

  if (results.length && game.settings.get(MODULE_ID, "showRollMessages")) {
    const lines = results
      .map(r => `<li><strong>${escapeHTML(r.name)}</strong>: ${r.total}</li>`)
      .join("");
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker(),
      content: `<section class="custom-initiative-chat"><h3>Iniciativa personalizada</h3><ol>${lines}</ol><p><small>Fórmula global: ${escapeHTML(baseFormula)} + modificador individual</small></p></section>`
    });
  }

  ui.notifications.info(`Iniciativa calculada para ${results.length} combatente(s).`);
  return combat;
}

function addTrackerControls(app, html) {
  if (!game.user.isGM || game.system.id !== "swade") return;
  const root = html?.[0] ?? html;
  if (!(root instanceof HTMLElement)) return;

  const header = root.querySelector(".directory-header .header-actions")
    ?? root.querySelector(".directory-header")
    ?? root.querySelector(".combat-tracker");

  if (header && !header.querySelector("[data-custom-initiative-toolbar]")) {
    const toolbar = document.createElement("div");
    toolbar.className = "custom-initiative-toolbar";
    toolbar.dataset.customInitiativeToolbar = "true";

    const rollButton = document.createElement("button");
    rollButton.type = "button";
    rollButton.className = "custom-initiative-roll";
    rollButton.innerHTML = '<i class="fas fa-dice-d20"></i> Iniciativa';
    rollButton.title = "Rolar iniciativa personalizada para todos os combatentes";
    rollButton.addEventListener("click", async (event) => {
      event.preventDefault();
      const combat = app.viewed ?? game.combat;
      if (!combat) return ui.notifications.warn("Não há combate ativo.");
      await rollCustomInitiative(combat, combat.combatants.map(c => c.id));
    });

    const configButton = document.createElement("button");
    configButton.type = "button";
    configButton.className = "custom-initiative-config";
    configButton.innerHTML = '<i class="fas fa-sliders-h"></i>';
    configButton.title = "Configurar fórmula global";
    configButton.addEventListener("click", (event) => {
      event.preventDefault();
      openFormulaConfig();
    });

    toolbar.append(rollButton, configButton);
    header.append(toolbar);
  }

  root.querySelectorAll("li.combatant[data-combatant-id], .combatant[data-combatant-id]").forEach(row => {
    if (row.querySelector("[data-custom-initiative-edit]")) return;
    const combatantId = row.dataset.combatantId;
    if (!combatantId) return;

    const controls = row.querySelector(".combatant-controls")
      ?? row.querySelector(".token-vision")
      ?? row;

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "custom-initiative-edit";
    editButton.dataset.customInitiativeEdit = "true";
    editButton.innerHTML = '<i class="fas fa-pen"></i>';
    editButton.title = "Editar modificador e iniciativa manual";
    editButton.setAttribute("aria-label", "Editar iniciativa");

    editButton.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      const combat = app.viewed ?? game.combat;
      const combatant = combat?.combatants.get(combatantId);
      if (combatant) await openCombatantEditor(combatant);
    });

    controls.append(editButton);
  });
}

function openFormulaConfig() {
  const current = game.settings.get(MODULE_ID, "formula") ?? "1d20";
  const content = `
    <form class="custom-initiative-form">
      <div class="form-group">
        <label>Fórmula global</label>
        <input type="text" name="formula" value="${escapeHTML(current)}" placeholder="Ex.: 1d20 + @atributo" />
        <p class="notes">Use a sintaxe de Roll do Foundry. Variáveis @ são resolvidas a partir de Actor.getRollData() do personagem.</p>
      </div>
      <p class="notes">Exemplo ilustrativo: <code>1d20 + @attributes.agility.die</code>. O caminho precisa existir nos dados reais do ator; consulte a ficha/dados do SWADE antes de usar.</p>
    </form>`;

  new Dialog({
    title: "Configurar iniciativa personalizada",
    content,
    buttons: {
      save: {
        label: "Salvar",
        callback: async (html) => {
          const formula = String(html.find('[name="formula"]').val() ?? "").trim();
          if (!formula) return ui.notifications.error("A fórmula não pode ficar vazia.");
          try {
            // Validação sintática; a avaliação real ocorre para cada ator.
            new Roll(formula);
            await game.settings.set(MODULE_ID, "formula", formula);
            ui.notifications.info("Fórmula global salva.");
          } catch (error) {
            ui.notifications.error(`Fórmula inválida: ${error.message}`);
          }
        }
      },
      cancel: { label: "Cancelar" }
    },
    default: "save"
  }).render(true);
}

async function openCombatantEditor(combatant) {
  if (!game.user.isGM) return;
  const currentModifier = Number(combatant.getFlag(FLAG_SCOPE, "modifier") ?? 0);
  const currentInitiative = combatant.initiative ?? "";
  const content = `
    <form class="custom-initiative-form">
      <div class="form-group">
        <label>Modificador individual</label>
        <input type="number" name="modifier" step="any" value="${currentModifier}" />
        <p class="notes">Somado à fórmula global sempre que este combatente rolar iniciativa.</p>
      </div>
      <div class="form-group">
        <label>Iniciativa manual</label>
        <input type="number" name="initiative" step="any" value="${currentInitiative}" placeholder="Deixe vazio para não alterar" />
        <p class="notes">Definir um valor manual altera a posição do combatente no Combat Tracker.</p>
      </div>
    </form>`;

  new Dialog({
    title: `Iniciativa: ${escapeHTML(combatant.name)}`,
    content,
    buttons: {
      save: {
        label: "Salvar",
        callback: async (html) => {
          const modifierValue = Number(html.find('[name="modifier"]').val());
          if (!Number.isFinite(modifierValue)) {
            ui.notifications.error("O modificador precisa ser numérico.");
            return;
          }
          await combatant.setFlag(FLAG_SCOPE, "modifier", modifierValue);

          const initiativeRaw = String(html.find('[name="initiative"]').val() ?? "").trim();
          if (initiativeRaw !== "") {
            const initiativeValue = Number(initiativeRaw);
            if (!Number.isFinite(initiativeValue)) {
              ui.notifications.error("A iniciativa manual precisa ser numérica.");
              return;
            }
            await combatant.combat.setInitiative(combatant.id, initiativeValue);
          }
          ui.notifications.info(`Configurações de ${combatant.name} salvas.`);
        }
      },
      cancel: { label: "Cancelar" }
    },
    default: "save"
  }).render(true);
}

function escapeHTML(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
