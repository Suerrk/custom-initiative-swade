# Custom Initiative for SWADE

Módulo experimental para Foundry VTT 14 e Savage Worlds Adventure Edition (SWADE) 6.0.4.

O módulo substitui `Combat.rollInitiative()` por uma rolagem numérica personalizada, mantendo o Combat Tracker e o controle de turnos nativos do Foundry.

## Funcionalidades

- Fórmula global configurável nas opções do módulo.
- Fórmulas avaliadas com `Roll` do Foundry e os dados de cada ator (`Actor.getRollData()`).
- Modificador individual salvo como flag no Combatant.
- Botão para rolar a iniciativa de todos os combatentes.
- Edição manual do modificador e do valor de iniciativa de cada combatente.
- A ordem do Combat Tracker é atualizada pelo próprio Foundry a partir dos valores numéricos de iniciativa.
- Mensagem resumida dos resultados no chat (configurável).

## Compatibilidade alvo

- Foundry VTT 14.370
- SWADE 6.0.4

**Estado:** versão inicial/experimental (0.1.0). Ainda precisa ser testada dentro de uma instalação real do Foundry com SWADE 6.0.4 e com os módulos adicionais que você utiliza.

## Instalação manual

1. Baixe `custom-initiative-swade.zip`.
2. Extraia a pasta `custom-initiative-swade` para `Data/modules/`.
3. Confirme que o caminho ficou `Data/modules/custom-initiative-swade/module.json`.
4. Reinicie o Foundry.
5. Abra seu mundo e ative **Custom Initiative for SWADE** em Gerenciar Módulos.
6. Abra o Combat Tracker. O botão **Iniciativa** deve aparecer no cabeçalho.

## Configuração da fórmula

Use o botão de controles (ícone de ajustes) ao lado do botão Iniciativa.

A fórmula é a mesma para todos. O módulo acrescenta o modificador individual de cada Combatant.

Exemplos de sintaxe do Foundry:

```text
1d20
1d20 + 3
1d10 + @algum.caminho.de.dados
```

Os exemplos com `@` são ilustrativos. O caminho precisa existir nos dados fornecidos por `actor.getRollData()` para o tipo de ator utilizado. Não assuma que `@attributes.agility.die` ou `@skills.athletics.value` existem sem conferir os dados do SWADE 6.0.4.

## Modificador e iniciativa manual

Cada linha do Combat Tracker recebe um botão de edição (lápis), visível para o Mestre.

- **Modificador individual:** é somado à fórmula na próxima rolagem daquele combatente.
- **Iniciativa manual:** grava um valor numérico diretamente no Combatant. O Foundry reorganiza a ordem do tracker com base nesse valor.

Para reordenar manualmente, atribua valores de iniciativa diferentes aos combatentes. Por exemplo, 30, 20, 10.

## Observações importantes

- O módulo substitui o método `rollInitiative` da classe de Combat ativa do sistema. Assim, chamadas normais a esse método passam a usar a fórmula personalizada em vez da distribuição de cartas.
- O SWADE possui recursos próprios de iniciativa (cartas, grupos e opções de combate como Hold/Act Now). Esta versão não reproduz recursos que dependam semanticamente das cartas. Teste grupos, ações adiadas e quaisquer automações de combate antes de usar em uma campanha em andamento.
- A integração visual do botão foi feita por seletores comuns do Combat Tracker. Se a interface mudar ou outro módulo substituir o tracker, talvez seja necessário ajustar os seletores.
- O método é substituído em runtime e pode conflitar com outros módulos que também sobrescrevam `Combat.rollInitiative`.
- Faça backup do mundo antes de testar.
- Não use em combate importante até validar em um mundo de teste.

## Desenvolvimento

Estrutura:

```text
custom-initiative-swade/
├── module.json
├── README.md
├── LICENSE
├── scripts/
│   └── main.js
└── styles/
    └── style.css
```

## Licença

MIT. Consulte `LICENSE`.
