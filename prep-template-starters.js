(function (root, factory) {
  const starters = factory();
  if (typeof module === "object" && module.exports) module.exports = starters;
  if (root) root.CampaignPrepTemplateStarters = starters;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  return [
    {
      schemaVersion: 1,
      id: "builtin-investigation",
      name: "Investigation",
      summary: "Prepare several leads, distinct sources of evidence, and a decision the group can make with incomplete knowledge. Allow 30 minutes beyond the suggested scenes for discussion and breaks.",
      durationMinutes: 180,
      openingPrompt: "Describe a troubling discovery, who wants answers, and what changes if nobody intervenes. Offer two immediately available leads without choosing which the group follows.",
      scenes: [
        { kind: "exploration", minutes: 20, prompts: { title: "Name the first evidence or discovery.", detail: "Describe something observable without a roll and two leads it suggests.", question: "Which lead could the group follow first, and what makes each worth pursuing?" } },
        { kind: "social", minutes: 35, prompts: { title: "Name the witnesses or competing accounts.", detail: "Prepare two witnesses with different knowledge and reasons to cooperate. State what each wants or fears.", question: "Whose help could the group seek, and what terms could it accept or negotiate?" } },
        { kind: "exploration", minutes: 35, prompts: { title: "Name a place where a lead can be tested.", detail: "Place useful evidence behind an assessable obstacle. Prepare another approach or source for essential information.", question: "What could the group risk to learn more, and how could it change its approach?" } },
        { kind: "social", minutes: 20, optional: true, prompts: { title: "Name a competing explanation the group may encounter.", detail: "Prepare a fact that complicates an assumption and a practical way to test it.", question: "What would let the group revise its theory or investigate the contradiction?" } },
        { kind: "pressure", minutes: 40, prompts: { title: "Name the opportunity to act on the evidence.", detail: "Identify who can respond to the discovery, what remains uncertain, and what delay changes.", question: "What actions remain available to the group with the evidence it has?" } }
      ],
      revelations: [
        { prompts: { text: "Write a concrete link between two leads and more than one way to discover it." } },
        { prompts: { text: "Write a fact that distinguishes competing explanations and where it can be checked." } },
        { prompts: { text: "Identify a practical route to someone who can help; let the group decide whether to use it." } }
      ],
      clocks: [{ max: 4, prompts: { label: "Name the evidence that becomes harder to reach. Define observable advances caused by delay or interference and what changes at completion." } }],
      spotlights: [
        { prompts: { character: "Choose a PC whose expertise could illuminate the evidence.", opportunity: "Prepare a fact their expertise can clarify and a decision that remains theirs." } },
        { prompts: { character: "Choose a PC with a useful connection to a witness.", opportunity: "Offer a reason to approach that witness, with room to decline or renegotiate the relationship." } }
      ],
      tasks: [
        { prompts: { text: "Define the underlying events and distinguish established facts from witness claims." } },
        { prompts: { text: "Prepare three leads that can be pursued in different orders." } },
        { prompts: { text: "Give an unsuccessful approach a useful consequence or another avenue of investigation." } }
      ]
    },
    {
      schemaVersion: 1,
      id: "builtin-social-event",
      name: "Social event",
      summary: "Prepare guests with separate priorities, negotiable offers, and public and private opportunities. Allow 30 minutes beyond the suggested scenes for conversation and breaks.",
      durationMinutes: 180,
      openingPrompt: "Establish the occasion, its public purpose, and two guests who want incompatible things. Give the PCs a reason to attend while leaving their allegiance open.",
      scenes: [
        { kind: "social", minutes: 20, prompts: { title: "Name the arrival or introduction opportunity.", detail: "Describe the host's expectations and an etiquette choice with a clear social consequence.", question: "How could the group present itself, and whom might it approach first?" } },
        { kind: "social", minutes: 35, prompts: { title: "Name the guests available for conversation.", detail: "Prepare three guests' wants, offers, and limits. Give each something to discuss besides the main dispute.", question: "Whose company or confidence could the group pursue, and at what cost?" } },
        { kind: "social", minutes: 35, prompts: { title: "Name a public opportunity during the occasion.", detail: "Prepare a toast, demonstration, petition, or contest with several valid responses and room to abstain.", question: "What could the group put at stake publicly, and what would choosing to remain quiet mean?" } },
        { kind: "social", minutes: 25, optional: true, prompts: { title: "Name a guest's private request.", detail: "Offer a favor with a clear cost and negotiable terms. Decide what the guest does if the offer is declined.", question: "How could the group accept, alter, or decline the request?" } },
        { kind: "pressure", minutes: 35, prompts: { title: "Name the closing opportunity for commitments.", detail: "Bring unresolved offers together as the occasion winds down. Keep each party's next action clear.", question: "What commitments could the group make, postpone, or refuse before departing?" } }
      ],
      revelations: [
        { prompts: { text: "Prepare an introduction that gives access to a useful person or opportunity." } },
        { prompts: { text: "Describe evidence of a difference between a guest's public position and private priorities." } },
        { prompts: { text: "Prepare a practical lead elsewhere in the campaign that the group can choose to pursue." } }
      ],
      clocks: [{ max: 4, prompts: { label: "Name the occasion's closing moment. Advance with scheduled events and show which opportunities remain before it arrives." } }],
      spotlights: [
        { prompts: { character: "Choose a PC with a relationship relevant to the occasion.", opportunity: "Prepare a conversation that lets the PC decide how that relationship develops." } },
        { prompts: { character: "Choose a PC who would welcome a quieter conversation.", opportunity: "Prepare a guest who values that PC's interest or experience and offers a meaningful choice." } }
      ],
      tasks: [
        { prompts: { text: "Write three guests' wants, offers, and limits." } },
        { prompts: { text: "Prepare one offer whose terms the PCs can change." } },
        { prompts: { text: "Decide how the host responds to disruption while leaving the group's response open." } }
      ]
    },
    {
      schemaVersion: 1,
      id: "builtin-exploration",
      name: "Exploration",
      summary: "Prepare connected routes, readable risks, and discoveries worth investigating. Allow 30 minutes beyond the suggested scenes for route discussion and breaks.",
      durationMinutes: 180,
      openingPrompt: "Present a destination or question worth pursuing, an unfamiliar landmark, and two routes with different visible costs.",
      scenes: [
        { kind: "exploration", minutes: 20, prompts: { title: "Name the landscape or landmark the group first encounters.", detail: "Describe visible signs of terrain, inhabitants, and recent change. Give information useful for choosing a route.", question: "What route or landmark might draw the group onward, and why?" } },
        { kind: "exploration", minutes: 40, prompts: { title: "Name a difficult passage.", detail: "Prepare a barrier with at least two approaches, an assessable risk, and a meaningful resource cost.", question: "How could the group cross, bypass, or decide to leave the barrier?" } },
        { kind: "exploration", minutes: 35, prompts: { title: "Name a place worth investigating.", detail: "Establish the location's function, signs of use, and discoveries available at different levels of commitment.", question: "How deeply could the group investigate, and what would further exploration require?" } },
        { kind: "social", minutes: 25, optional: true, prompts: { title: "Name another traveler or local inhabitant.", detail: "Give them a destination, useful knowledge, and an immediate need. Prepare a response if the PCs pass by.", question: "What help could be exchanged, and why might the group choose to continue independently?" } },
        { kind: "pressure", minutes: 30, prompts: { title: "Name the next boundary or turning point.", detail: "Reveal what further travel requires, somewhere a foothold could be established, and a viable return route.", question: "What would lead the group to press on, establish a foothold, or turn back?" } }
      ],
      revelations: [
        { prompts: { text: "Describe a landmark that gives the group useful navigation information." } },
        { prompts: { text: "Prepare evidence of who uses the area and what they do here." } },
        { prompts: { text: "Prepare a discovery that opens a new destination without requiring the group to visit it." } }
      ],
      clocks: [{ max: 6, prompts: { label: "Name a worsening travel condition. Define what advances it and visible changes in weather, access, or visibility at selected thresholds." } }],
      spotlights: [
        { prompts: { character: "Choose a PC whose background helps interpret the surroundings.", opportunity: "Prepare a sign they can understand and information that supports a route choice." } },
        { prompts: { character: "Choose a PC with a curiosity this area could reward.", opportunity: "Offer a discovery they may investigate, share, or leave for another journey." } }
      ],
      tasks: [
        { prompts: { text: "Sketch connected routes with distinct costs and return options." } },
        { prompts: { text: "Decide what information is visible before each route choice." } },
        { prompts: { text: "Prepare a useful or interesting discovery for each viable path." } }
      ]
    },
    {
      schemaVersion: 1,
      id: "builtin-dungeon-expedition",
      name: "Dungeon expedition",
      summary: "Prepare connected spaces, occupants with goals, and choices about entry, risk, and withdrawal. Allow 40 minutes beyond the suggested scenes for tactical discussion and breaks.",
      durationMinutes: 240,
      openingPrompt: "Establish why the site matters now, a visible sign of current occupation, and an entrance the group can assess before committing.",
      scenes: [
        { kind: "exploration", minutes: 25, prompts: { title: "Name the approach and entry point.", detail: "Show defenses, alternate access, and signs of use. Make at least one risk visible before entry.", question: "How could the group enter, and what might its approach reveal about its presence?" } },
        { kind: "exploration", minutes: 40, prompts: { title: "Name the first meaningful junction.", detail: "Give two routes distinct clues and costs. Establish how the group can revisit or connect these spaces.", question: "What priority could guide the group's route choice?" } },
        { kind: "scene", minutes: 50, prompts: { title: "Name an occupied space.", detail: "Define the occupants' activity, needs, and response to intrusion. Prepare information useful for avoiding or communicating with them.", question: "What options support negotiation, avoidance, distraction, or confrontation?" } },
        { kind: "exploration", minutes: 35, optional: true, prompts: { title: "Name a tempting detour.", detail: "Place a useful discovery behind an assessable risk and show what additional commitment it requires.", question: "Why might the group consider this worth its time or resources, or leave it for later?" } },
        { kind: "pressure", minutes: 50, prompts: { title: "Name the objective and withdrawal opportunity.", detail: "Explain the objective's circumstances, competing claims, and viable ways out. Keep a partial success or retreat possible.", question: "What could the group attempt, carry away, leave behind, or return for?" } }
      ],
      revelations: [
        { prompts: { text: "Prepare a sign explaining the site's function or a change in its use." } },
        { prompts: { text: "Place evidence of a safer, faster, or less conspicuous route." } },
        { prompts: { text: "Prepare information that changes how the objective can be approached." } }
      ],
      clocks: [{ max: 6, prompts: { label: "Name how the site responds to intrusion. Advance after noticeable actions and define responses appropriate to its occupants at selected thresholds." } }],
      spotlights: [
        { prompts: { character: "Choose a PC who could recognize a useful construction or practice.", opportunity: "Offer information that opens an approach while leaving the choice to the group." } },
        { prompts: { character: "Choose a PC with a reason to care about something in the site.", opportunity: "Prepare a meaningful choice about what to preserve, recover, or leave behind." } }
      ],
      tasks: [
        { prompts: { text: "Draw connected spaces, alternate approaches, and usable exits." } },
        { prompts: { text: "State occupant goals and what they do before the PCs intervene." } },
        { prompts: { text: "Prepare warning signs before major hazards and identify a workable retreat." } }
      ]
    },
    {
      schemaVersion: 1,
      id: "builtin-heist",
      name: "Heist",
      summary: "Prepare a negotiable objective, several access approaches, and independent sources of pressure. Allow 40 minutes beyond the suggested scenes for player planning and breaks.",
      durationMinutes: 210,
      openingPrompt: "Establish something the group might obtain or accomplish, who controls access, and why the opportunity is time-sensitive. Leave the objective and acceptable methods open to negotiation.",
      scenes: [
        { kind: "social", minutes: 25, prompts: { title: "Name the proposed job or opportunity.", detail: "Clarify the offer, competing interests, known costs, and what remains negotiable.", question: "What objective and limits could the group accept, change, or refuse?" } },
        { kind: "exploration", minutes: 35, prompts: { title: "Name the survey or preparation opportunity.", detail: "Prepare several access points, observable routines, and people who could supply useful information.", question: "Which uncertainties could the group investigate before acting?" } },
        { kind: "scene", minutes: 45, prompts: { title: "Name the point where the group seeks access.", detail: "Establish routines and obstacles with multiple workable approaches, including a route to withdrawal.", question: "How could the group enter, gain cooperation, or influence access?" } },
        { kind: "pressure", minutes: 40, prompts: { title: "Name the objective's immediate surroundings.", detail: "Prepare a complication grounded in the established situation. Show signs of it early enough to support a choice.", question: "What options let the group adapt its method, alter its objective, or withdraw?" } },
        { kind: "social", minutes: 25, optional: true, prompts: { title: "Name an obligation or interested party that may follow the attempt.", detail: "Bring a helper, rival, or other interested party into the aftermath according to what actually happened.", question: "What could the group promise, disclose, negotiate over, or keep?" } }
      ],
      revelations: [
        { prompts: { text: "Describe a routine that creates an access opportunity and how it can be observed." } },
        { prompts: { text: "Identify a dependency the group can influence, exploit, or negotiate over." } },
        { prompts: { text: "Prepare a discoverable alternative exit or withdrawal opportunity." } }
      ],
      clocks: [
        { max: 6, prompts: { label: "Name who is paying increasing attention. Define visible triggers and responses, distinguishing suspicion from confirmed detection." } },
        { max: 4, prompts: { label: "Name an access opportunity that changes over time. Define its independent triggers and what becomes possible or harder when it changes." } }
      ],
      spotlights: [
        { prompts: { character: "Choose a PC with a distinct contribution to preparation or execution.", opportunity: "Prepare a chance to contribute that supports more than one approach." } },
        { prompts: { character: "Choose a PC whose relationship could create another option.", opportunity: "Offer help with a negotiable cost and a viable path if the PC declines." } }
      ],
      tasks: [
        { prompts: { text: "Define the objective's surroundings and prepare three access approaches." } },
        { prompts: { text: "Distinguish suspicion, detection, and the responses each triggers." } },
        { prompts: { text: "Establish withdrawal options and decide what an interrupted attempt changes." } }
      ]
    },
    {
      schemaVersion: 1,
      id: "builtin-downtime",
      name: "Downtime",
      summary: "Make room for player priorities, projects, relationships, and next-session intentions. Allow 20 minutes beyond the suggested scenes for transitions and discussion; divide spotlight time across the group.",
      durationMinutes: 120,
      openingPrompt: "Establish the available breathing space. Ask each player for a priority: recover, pursue a project, cultivate a relationship, or investigate a personal concern.",
      scenes: [
        { kind: "social", minutes: 15, prompts: { title: "Name the opportunity to choose priorities.", detail: "Present current opportunities and obligations. Ask how much table time each player wants for their priority.", question: "Where does each PC want to invest their attention, and who might work together?" } },
        { kind: "scene", minutes: 25, prompts: { title: "Name a player-chosen project or recovery activity.", detail: "Clarify progress, needed resources, and a useful next step with the player. Divide the scene time across interested PCs.", question: "What cost or compromise might each PC accept, change, or defer?" } },
        { kind: "social", minutes: 25, prompts: { title: "Name a relationship the player wants to explore.", detail: "Give the contact their own need or changing circumstances. Invite the player to state what their PC hopes for.", question: "How does the PC want the relationship to develop, and what can they choose to offer?" } },
        { kind: "pressure", minutes: 20, optional: true, prompts: { title: "Name an outside development that could interrupt downtime.", detail: "Prepare a campaign development that can be addressed, delegated, or deferred. Make the cost of delay understandable.", question: "Would the group change its priorities, find help, or continue its chosen work?" } },
        { kind: "social", minutes: 15, prompts: { title: "Name the closing discussion about what comes next.", detail: "Gather unfinished intentions and available leads. Record player preferences without settling future outcomes.", question: "Which opportunity should shape the next session, and what does each player want to pursue?" } }
      ],
      revelations: [
        { prompts: { text: "Prepare news relevant to a priority a player has chosen." } },
        { prompts: { text: "Clarify a concrete requirement or opportunity for a player-chosen project." } },
        { prompts: { text: "Prepare an invitation or lead the group can accept, alter, or decline." } }
      ],
      clocks: [{ max: 4, prompts: { label: "Name a project chosen by a player. Agree what meaningful contributions advance it and what result completion delivers." } }],
      spotlights: [
        { prompts: { character: "Choose a PC whose priority needs an individual scene.", opportunity: "Reserve time for their chosen activity and ask what kind of interaction would be useful." } },
        { prompts: { character: "Choose a PC who wants another PC involved in their activity.", opportunity: "Invite the players to decide whether and how their priorities connect." } }
      ],
      tasks: [
        { prompts: { text: "Collect player priorities and share the available spotlight time." } },
        { prompts: { text: "Define project progress and costs collaboratively with interested players." } },
        { prompts: { text: "Prepare contact responses and leave room to record next-session intentions." } }
      ]
    }
  ];
});
