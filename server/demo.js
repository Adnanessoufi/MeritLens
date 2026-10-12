export const demoWork = {
  title: 'Cities that cool: a tree-canopy proposal',
  subject: 'Environmental science',
  brief: 'Propose a way to reduce pedestrian heat exposure. Explain how it works, how you would test the idea fairly, and a practical trade-off.',
  concepts: ['Cooling mechanism', 'Evidence and controls', 'Trade-offs'],
  text: `My tree-canopy proposal

Cooling mechanism
I propose adding trees along exposed pedestrian routes. Trees shade pavement, reducing the sunlight that heats the surface. Water evaporating from leaves can also use heat from the surrounding air. Shade and evapotranspiration are different mechanisms; the effect depends on weather and water availability.

Evidence and controls
In a fictional pilot dataset, I compared six shaded locations with six exposed locations. I measured air temperature at the same height and time using calibrated sensors. The shaded locations averaged 1.8 degrees cooler, but this observation alone does not prove trees caused the difference. Building shade, wind, traffic and the choice of locations could confound the comparison. I would repeat matched measurements across several days and compare similar locations before and after planting. Surface temperature is not the same as air temperature.

Trade-offs
I would prioritize routes used by people who have little access to shade. Trees need space, maintenance and water, and their benefits take time. Drought-tolerant species and a maintenance budget can help, but planting more trees without considering water use is not automatically the best choice. I would compare trees with shade structures where underground utilities or water scarcity make trees unsuitable.`,
  questions: [
    ['Cooling mechanism', 'Your proposal mentions both shade and evaporation. How do these two mechanisms reduce heat?'],
    ['Evidence and controls', 'Your pilot found a 1.8-degree difference. Why is that not enough to prove the trees caused it?'],
    ['Trade-offs', 'What would make a shade structure a better choice than planting a tree in your proposal?'],
  ],
}

export const showcaseCases = [
  { kind: 'reasoning', student: 'Nora · fictional demo', title: 'Reasoning that holds up', description: 'Explains mechanisms, challenges the comparison, and weighs a practical trade-off.',
    answers: {
      'Cooling mechanism': [
        'Shade blocks some sunlight from heating pavement. Evapotranspiration is different: evaporating water from leaves uses energy, so it can cool the nearby air. In dry weather there may be less evaporation if water is limited, but shade can still help.',
        'With little available water, a tree may reduce water loss and evaporative cooling may weaken. That does not remove the shade effect. I would measure air temperature and surface temperature separately rather than assuming they respond equally.',
      ],
      'Evidence and controls': [
        'The 1.8-degree difference is an association in our fictional pilot, not proof of causation. Shaded and exposed locations may differ in building shade, wind or traffic. Matching similar locations and times, calibrating sensors, and repeating the comparison across days would reduce those alternative explanations.',
        'I would compare matched sites before and after planting, using the same calibrated sensors, height and measurement times. I would also keep comparable unplanted sites so weather changes do not get mistaken for a tree effect. It would still be an observational estimate with uncertainty.',
      ],
      'Trade-offs': [
        'If underground utilities leave too little root space or the water budget is too limited, a shade structure may provide useful shade sooner with less irrigation. Trees also offer other benefits, but those benefits do not erase maintenance cost or the delay before the canopy grows.',
        'I would choose based on the route’s needs and constraints rather than always choosing trees. A structure might give immediate shade with less water demand; a suitable tree might deliver a growing canopy and habitat over time. The comparison needs installation and maintenance costs, available space and shade coverage.',
      ],
    },
  },
  { kind: 'reflection', student: 'Sam · fictional demo', title: 'Understanding develops in the conversation', description: 'Starts with a misconception, then corrects it under a follow-up. The correction remains visible.',
    answers: {
      'Cooling mechanism': [
        'I think the main cooling happens because trees absorb carbon dioxide. I am not clear on how water from a leaf changes the temperature.',
        'I should correct my first explanation. Shade reduces sunlight reaching the ground. Evaporation needs energy, which can remove heat from the surroundings. That is a local cooling mechanism; simply absorbing carbon dioxide does not explain the immediate temperature difference at the pedestrian route.',
      ],
      'Evidence and controls': [
        'I measured the same time and height to make the sites comparable, but I had assumed that 1.8 degrees proves the trees work. Other differences between the locations could also matter.',
        'Wind or building shade could make one location cooler even without the trees. I would match those conditions and repeat measurements over several days. I cannot confidently estimate the size of the causal effect from this small fictional comparison alone.',
      ],
      'Trade-offs': [
        'Trees need water and maintenance. A shade structure could be more practical where roots cannot fit around underground utilities, especially if we need shade immediately.',
        'I would compare how much shade each option provides when people use the route, then consider water availability, root space and maintenance. I would ask for better cost data before deciding because I have not estimated lifetime costs.',
      ],
    },
  },
  { kind: 'follow-up', student: 'Alex · fictional demo', title: 'Polished work, missing explanation', description: 'Repeats terms and conclusions but cannot explain the mechanisms or defend the evidence.',
    answers: {
      'Cooling mechanism': ['Shade trees evaporation canopy carbon cooling green sustainable evapotranspiration shade climate.', 'I cannot explain what happens when the water evaporates. I just know that trees are good.'],
      'Evidence and controls': ['It was 1.8 degrees cooler, so that proves the trees caused it. We do not need controls because the result is positive.', 'I am not sure why the measurement height or weather would matter. The difference is enough proof.'],
      'Trade-offs': ['Trees are always better in every place. Maintenance and water are not important because the project is sustainable.', 'I cannot give a situation in which the shade structure would be a better option.'],
    },
  },
]

export const probe = {
  question: { concept: 'Data structures', text: 'Why did you use a dictionary instead of a list for looking up books by ISBN?' },
  analysis: { summary: 'A Python reading list uses ISBN keys to find books efficiently.', sections: ['Design'], concepts: [{ name: 'Data structures', evidence: 'Dictionary lookup averages O(1); scanning a list takes O(n).', method: 'ISBN-keyed dictionary lookup', claim: 'The dictionary improves average lookup time at a memory cost.' }], questions: [] },
  examples: {
    concise: 'ISBN uniquely identifies each book. Dictionary lookup averages O(1), whereas finding a book in a list requires O(n) scanning. The dictionary costs more memory.',
    keywords: 'Dictionary dictionary ISBN hash testing constant complexity collision search testing memory dictionary ISBN hash constant time.',
    incorrect: 'The dictionary scans every book for every lookup so its average complexity is O(n). A list hashes the ISBN and always finds the book in constant time. I chose the dictionary because it is faster in all cases.',
  },
}
