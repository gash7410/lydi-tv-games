// «Ποιος είναι;»: η τηλεόραση δείχνει στοιχεία για ένα διάσημο πρόσωπο, ένα-ένα,
// από το πιο δύσκολο στο πιο εύκολο. Οι παίκτες διαλέγουν στο κινητό μία από 4 απαντήσεις.
// Όσο λιγότερα στοιχεία χρειαστείς, τόσο περισσότερους πόντους παίρνεις (4·3·2·1, +1 στον πρώτο).
// Λάθος απάντηση = 0 πόντοι για αυτή την ερώτηση. Μετά από QN ερωτήσεις νικά ο πρώτος σε πόντους.
(function () {
  'use strict';
  const { Base, U } = Mini;

  const CATS = {
    arx: { name: 'Αρχαία Ελλάδα', c: '#ffc93d' },
    myth: { name: 'Μυθολογία', c: '#9b5de5' },
    gr: { name: 'Νεότερη Ελλάδα', c: '#3da9ff' },
    world: { name: 'Κόσμος', c: '#2ecc71' },
  };

  // [όνομα, κατηγορία, 4 στοιχεία από το δύσκολο στο εύκολο]
  const PEOPLE = [
    ['Μέγας Αλέξανδρος', 'arx', ['Δάσκαλός του ήταν ο Αριστοτέλης', 'Το άλογό του λεγόταν Βουκεφάλας', 'Έφτασε με τον στρατό του ως την Ινδία', 'Βασιλιάς της Μακεδονίας, γιος του Φιλίππου Β΄']],
    ['Σωκράτης', 'arx', ['Δεν έγραψε ποτέ ούτε ένα βιβλίο', 'Καταδικάστηκε να πιει το κώνειο', 'Μαθητής του ήταν ο Πλάτων', '«Ἓν οἶδα ὅτι οὐδὲν οἶδα»']],
    ['Αριστοτέλης', 'arx', ['Γεννήθηκε στα Στάγειρα της Χαλκιδικής', 'Ίδρυσε στην Αθήνα μια σχολή, το Λύκειο', 'Ήταν δάσκαλος του νεαρού Μεγάλου Αλεξάνδρου', 'Μαθητής του Πλάτωνα']],
    ['Πλάτων', 'arx', ['Ίδρυσε την Ακαδημία στην Αθήνα', 'Έγραψε τον «Μύθο του σπηλαίου»', 'Έγραψε την «Πολιτεία»', 'Μαθητής του Σωκράτη, δάσκαλος του Αριστοτέλη']],
    ['Περικλής', 'arx', ['Αθηναίος πολιτικός του 5ου αιώνα π.Χ.', 'Στα χρόνια του χτίστηκε ο Παρθενώνας', 'Εκφώνησε τον περίφημο «Επιτάφιο»', 'Η εποχή του λέγεται «Χρυσός Αιώνας»']],
    ['Λεωνίδας', 'arx', ['Βασιλιάς της Σπάρτης', 'Απάντησε στους Πέρσες «Μολὼν λαβέ»', 'Πολέμησε τον στρατό του Ξέρξη', 'Έπεσε στις Θερμοπύλες με τους 300']],
    ['Αρχιμήδης', 'arx', ['Έζησε στις Συρακούσες της Σικελίας', 'Λένε ότι έκαψε εχθρικά πλοία με καθρέφτες', 'Ανακάλυψε την άνωση μέσα στο λουτρό', 'Βγήκε στον δρόμο φωνάζοντας «Εύρηκα!»']],
    ['Πυθαγόρας', 'arx', ['Γεννήθηκε στη Σάμο', 'Ίδρυσε κοινότητα φιλοσόφων στον Κρότωνα', 'Πίστευε ότι όλα είναι αριθμοί', 'Το πιο γνωστό του θεώρημα αφορά ορθογώνια τρίγωνα']],
    ['Ιπποκράτης', 'arx', ['Έζησε τον 5ο αιώνα π.Χ.', 'Γεννήθηκε στην Κω', 'Οι γιατροί δίνουν όρκο με το όνομά του', 'Θεωρείται ο πατέρας της Ιατρικής']],
    ['Όμηρος', 'arx', ['Η παράδοση λέει ότι ήταν τυφλός', 'Επτά πόλεις έλεγαν ότι γεννήθηκε εκεί', 'Έγραψε την «Ιλιάδα»', 'Έγραψε και την «Οδύσσεια»']],

    ['Ηρακλής', 'myth', ['Γιος του Δία και της Αλκμήνης', 'Σκότωσε τη Λερναία Ύδρα', 'Φορούσε το δέρμα του λιονταριού της Νεμέας', 'Έκανε τους 12 άθλους']],
    ['Οδυσσέας', 'myth', ['Βασιλιάς της Ιθάκης', 'Τύφλωσε τον Κύκλωπα Πολύφημο', 'Η Πηνελόπη τον περίμενε 20 χρόνια', 'Σκέφτηκε τον Δούρειο Ίππο']],
    ['Αχιλλέας', 'myth', ['Η μητέρα του, η Θέτιδα, τον βούτηξε στη Στύγα', 'Ο καλύτερός του φίλος ήταν ο Πάτροκλος', 'Σκότωσε τον Έκτορα στην Τροία', 'Ήταν τρωτός μόνο στη φτέρνα']],
    ['Δίας', 'myth', ['Γιος του Κρόνου και της Ρέας', 'Τον μεγάλωσε η κατσίκα Αμάλθεια στην Κρήτη', 'Ιερό του πουλί ο αετός', 'Ρίχνει κεραυνούς· βασιλιάς των θεών']],
    ['Αθηνά', 'myth', ['Γεννήθηκε πάνοπλη από το κεφάλι του πατέρα της', 'Ιερό της πουλί η κουκουβάγια', 'Χάρισε την ελιά και κέρδισε τον Ποσειδώνα', 'Θεά της σοφίας· μια πόλη πήρε το όνομά της']],
    ['Ποσειδώνας', 'myth', ['Αδελφός του Δία και του Άδη', 'Χτύπησε τον βράχο της Ακρόπολης και έβγαλε θαλασσινό νερό', 'Κρατάει τρίαινα', 'Θεός της θάλασσας']],
    ['Περσέας', 'myth', ['Γιος του Δία και της Δανάης', 'Έσωσε την Ανδρομέδα από ένα θαλάσσιο τέρας', 'Φορούσε φτερωτά σανδάλια', 'Έκοψε το κεφάλι της Μέδουσας']],
    ['Θησέας', 'myth', ['Γιος του βασιλιά Αιγέα της Αθήνας', 'Η Αριάδνη του έδωσε ένα κουβάρι κλωστή', 'Βρήκε τον δρόμο μέσα στον Λαβύρινθο', 'Σκότωσε τον Μινώταυρο']],

    ['Θεόδωρος Κολοκοτρώνης', 'gr', ['Γεννήθηκε το 1770 στη Μεσσηνία', 'Νίκησε τον Δράμαλη στα Δερβενάκια', 'Πήρε την Τριπολιτσά το 1821', 'Τον έλεγαν «ο Γέρος του Μοριά»']],
    ['Λασκαρίνα Μπουμπουλίνα', 'gr', ['Έζησε στις Σπέτσες', 'Έχτισε με δικά της χρήματα το πλοίο «Αγαμέμνων»', 'Πήρε μέρος στην πολιορκία του Ναυπλίου', 'Η πιο γνωστή καπετάνισσα του 1821']],
    ['Ιωάννης Καποδίστριας', 'gr', ['Γεννήθηκε στην Κέρκυρα', 'Υπήρξε υπουργός Εξωτερικών της Ρωσίας', 'Δολοφονήθηκε στο Ναύπλιο το 1831', 'Ο πρώτος Κυβερνήτης της Ελλάδας']],
    ['Ελευθέριος Βενιζέλος', 'gr', ['Γεννήθηκε στην Κρήτη', 'Υπέγραψε τη Συνθήκη των Σεβρών', 'Έγινε πρωθυπουργός πολλές φορές', 'Το αεροδρόμιο της Αθήνας έχει το όνομά του']],
    ['Μελίνα Μερκούρη', 'gr', ['Ηθοποιός που έγινε πολιτικός', 'Πρωταγωνίστησε στο «Ποτέ την Κυριακή»', 'Έγινε υπουργός Πολιτισμού', 'Ζήτησε την επιστροφή των Γλυπτών του Παρθενώνα']],
    ['Νίκος Καζαντζάκης', 'gr', ['Γεννήθηκε στο Ηράκλειο της Κρήτης', 'Έγραψε μια «Οδύσσεια» 33.333 στίχων', 'Στον τάφο του: «Δεν ελπίζω τίποτα, δε φοβούμαι τίποτα…»', 'Έγραψε τον «Αλέξη Ζορμπά»']],
    ['Μαρία Κάλλας', 'gr', ['Γεννήθηκε στη Νέα Υόρκη από Έλληνες γονείς', 'Την έλεγαν «La Divina»', 'Τραγούδησε τη «Νόρμα» σε όλο τον κόσμο', 'Η πιο διάσημη σοπράνο της όπερας']],
    ['Οδυσσέας Ελύτης', 'gr', ['Η οικογένειά του καταγόταν από τη Λέσβο', 'Πήρε το Νόμπελ Λογοτεχνίας το 1979', 'Έγραψε «Ο ήλιος ο ηλιάτορας»', 'Έγραψε το «Άξιον Εστί»']],
    ['Γιώργος Σεφέρης', 'gr', ['Ήταν διπλωμάτης', 'Γεννήθηκε κοντά στη Σμύρνη', 'Έγραψε «Ο βασιλιάς της Ασίνης»', 'Ο πρώτος Έλληνας με Νόμπελ Λογοτεχνίας (1963)']],
    ['Μίκης Θεοδωράκης', 'gr', ['Γεννήθηκε στη Χίο', 'Μελοποίησε το «Άξιον Εστί» του Ελύτη', 'Μελοποίησε τον «Επιτάφιο» του Ρίτσου', 'Έγραψε τη μουσική του «Ζορμπά»']],
    ['Μάνος Χατζιδάκις', 'gr', ['Γεννήθηκε στην Ξάνθη', 'Ίδρυσε την Ορχήστρα των Χρωμάτων', 'Πήρε Όσκαρ μουσικής το 1961', 'Έγραψε «Τα παιδιά του Πειραιά»']],
    ['Γιάννης Αντετοκούνμπο', 'gr', ['Μεγάλωσε στα Σεπόλια της Αθήνας', 'Έπαιξε στον Φιλαθλητικό', 'Πήρε το πρωτάθλημα NBA το 2021 με τους Μπακς', 'Τον λένε «Greek Freak»']],
    ['Διονύσιος Σολωμός', 'gr', ['Γεννήθηκε στη Ζάκυνθο', 'Έγραψε τους «Ελεύθερους Πολιορκημένους»', 'Τον λέμε Εθνικό μας Ποιητή', 'Έγραψε τον «Ύμνο εις την Ελευθερίαν»']],
    ['Κωνσταντίνος Καβάφης', 'gr', ['Έζησε σχεδόν όλη του τη ζωή στην Αλεξάνδρεια', 'Δούλευε υπάλληλος στην Υπηρεσία Αρδεύσεων', 'Έγραψε «Περιμένοντας τους βαρβάρους»', 'Έγραψε την «Ιθάκη»']],

    ['Άλμπερτ Αϊνστάιν', 'world', ['Γεννήθηκε στη Γερμανία το 1879', 'Πήρε το Νόμπελ Φυσικής το 1921', 'Σε διάσημη φωτογραφία βγάζει τη γλώσσα', 'E = mc²']],
    ['Λεονάρντο ντα Βίντσι', 'world', ['Ζωγράφος και εφευρέτης της Αναγέννησης', 'Σχεδίασε ιπτάμενες μηχανές αιώνες πριν από τα αεροπλάνα', 'Ζωγράφισε τον «Μυστικό Δείπνο»', 'Ζωγράφισε τη «Μόνα Λίζα»']],
    ['Βόλφγκανγκ Αμαντέους Μότσαρτ', 'world', ['Γεννήθηκε στο Σάλτσμπουργκ', 'Έγραφε μουσική από 5 χρονών', 'Έγραψε την όπερα «Ο μαγικός αυλός»', 'Έγραψε τη «Μικρή νυχτερινή μουσική»']],
    ['Μαρί Κιουρί', 'world', ['Γεννήθηκε στη Βαρσοβία', 'Η πρώτη γυναίκα που πήρε Νόμπελ', 'Πήρε Νόμπελ σε δύο διαφορετικές επιστήμες', 'Ανακάλυψε το ράδιο και το πολώνιο']],
    ['Χριστόφορος Κολόμβος', 'world', ['Γεννήθηκε στη Γένοβα', 'Ήθελε να φτάσει στην Ινδία πλέοντας δυτικά', 'Τα πλοία του: Νίνια, Πίντα, Σάντα Μαρία', 'Έφτασε στην Αμερική το 1492']],
    ['Ουίλιαμ Σαίξπηρ', 'world', ['Γεννήθηκε στο Στράτφορντ της Αγγλίας', 'Έγραψε τον «Μάκβεθ»', '«Να ζει κανείς ή να μη ζει;»', 'Έγραψε το «Ρωμαίος και Ιουλιέτα»']],
    ['Ναπολέων Βοναπάρτης', 'world', ['Γεννήθηκε στην Κορσική', 'Πέθανε εξόριστος στην Αγία Ελένη', 'Ηττήθηκε στο Βατερλό', 'Αυτοκράτορας των Γάλλων']],
    ['Γαλιλαίος', 'world', ['Ιταλός επιστήμονας', 'Δικάστηκε από την Ιερά Εξέταση', 'Με το τηλεσκόπιό του είδε τους δορυφόρους του Δία', 'Του αποδίδεται το «Κι όμως γυρίζει!»']],
    ['Τσάρλι Τσάπλιν', 'world', ['Γεννήθηκε στο Λονδίνο', 'Έγινε διάσημος στον βωβό κινηματογράφο', 'Πρωταγωνίστησε στους «Μοντέρνους καιρούς»', 'Ο «Σαρλό» με το μουστακάκι και το μπαστούνι']],
    ['Νέλσον Μαντέλα', 'world', ['Πέρασε 27 χρόνια στη φυλακή', 'Πήρε το Νόμπελ Ειρήνης το 1993', 'Πάλεψε κατά του απαρτχάιντ', 'Ο πρώτος μαύρος πρόεδρος της Νότιας Αφρικής']],
    ['Βίνσεντ βαν Γκογκ', 'world', ['Ολλανδός ζωγράφος', 'Στη ζωή του πούλησε ελάχιστους πίνακες', 'Έκοψε ένα κομμάτι από το αυτί του', 'Ζωγράφισε την «Έναστρη νύχτα» και τους «Ηλίανθους»']],
    ['Ισαάκ Νεύτων', 'world', ['Άγγλος επιστήμονας του 17ου αιώνα', 'Έφτιαξε το πρώτο κατοπτρικό τηλεσκόπιο', 'Διατύπωσε τους τρεις νόμους της κίνησης', 'Ένα μήλο που έπεσε τον έβαλε να σκεφτεί τη βαρύτητα']],
  ];

  const QN = 8;          // ερωτήσεις ανά παιχνίδι
  const CLUE_SEC = 6;    // δευτερόλεπτα ανά στοιχείο
  const LAST_SEC = 7;    // χρόνος μετά το τελευταίο στοιχείο
  const OPT_C = ['#ff6b5e', '#3da9ff', '#ffc93d', '#2ecc71'];
  const LET = ['Α', 'Β', 'Γ', 'Δ'];

  const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
  // τράπουλα που κρατιέται από παιχνίδι σε παιχνίδι, για να μην επαναλαμβάνονται πρόσωπα
  let deck = [];
  const nextPerson = () => { if (!deck.length) deck = shuffle(PEOPLE.map((_, i) => i)); return PEOPLE[deck.pop()]; };

  class WhoGame extends Base {
    constructor(c, h) { super(c, h); this.WIN = 0; } // χωρίς όριο πόντων· τελειώνει μετά από QN ερωτήσεις

    setup() { this.qi = 0; this.qid = 0; this.parts.forEach((p) => (p.right = 0)); this.newRound(); }

    newRound() {
      this.qi++; this.qid++;
      const [name, cat, clues] = nextPerson();
      const others = shuffle(PEOPLE.filter((p) => p[1] === cat && p[0] !== name)).slice(0, 3).map((p) => p[0]);
      this.opts = shuffle([name, ...others]);
      this.correct = this.opts.indexOf(name);
      this.q = { name, cat, clues };
      this.shown = 0; this.firstDone = false;
      this.parts.forEach((p) => { p.ans = null; p.gain = 0; p.status = ''; p.hi = false; });
      this.phase = 'intro'; this.phaseT = this.time;
      this.banner(`Ερώτηση ${this.qi}/${QN}`, '#fff');
      this.sfx('blip');
      const id = this.qid;
      this.after(1.6, () => { if (this.qid === id) { this.phase = 'clues'; this.nextClue(); } });
      this.changed();
    }

    nextClue() {
      if (this.phase !== 'clues') return;
      this.shown++; this.clueT = this.time;
      this.sfx(this.shown === 1 ? 'go' : 'tick');
      const id = this.qid, n = this.shown;
      this.botsThink();
      this.changed();
      this.after(n < 4 ? CLUE_SEC : LAST_SEC, () => {
        if (this.qid !== id || this.phase !== 'clues' || this.shown !== n) return;
        n < 4 ? this.nextClue() : this.reveal();
      });
    }

    botsThink() {
      for (const b of this.parts.filter((p) => p.bot && !p.ans)) {
        // κάθε ρομπότ ξέρει την απάντηση με πιθανότητα που ανεβαίνει με τα στοιχεία
        if (Math.random() < [0, 0.18, 0.3, 0.5, 0.9][this.shown]) {
          const id = this.qid, ok = Math.random() < 0.78;
          const pick = ok ? this.correct : U.pick([0, 1, 2, 3].filter((i) => i !== this.correct));
          this.after(U.rand(1.2, 4.5), () => this.qid === id && this.answer(b, pick));
        }
      }
    }

    input(part, msg) { if (msg.type === 'ans') this.answer(part, msg.i | 0); }

    answer(part, i) {
      if (!part || part.ans || this.phase !== 'clues' || this.over || i < 0 || i > 3) return;
      const ok = i === this.correct;
      let gain = 0;
      if (ok) { gain = 5 - this.shown; if (!this.firstDone) { this.firstDone = true; gain++; } }
      part.ans = { i, ok, at: this.shown };
      part.gain = gain;
      part.status = 'απάντησε ✔';
      this.sfx('pump');
      this.fx(part, 'Η απάντησή σου κλείδωσε 🔒', [25]);
      this.changed();
      const live = this.parts.filter((p) => p.bot || (p.p && p.p.connected));
      if (live.every((p) => p.ans)) { const id = this.qid; this.after(0.8, () => this.qid === id && this.reveal()); }
    }

    reveal() {
      if (this.phase !== 'clues') return;
      this.phase = 'reveal'; this.phaseT = this.time;
      this.shown = Math.max(this.shown, 1);
      const right = this.parts.filter((p) => p.ans && p.ans.ok);
      for (const p of this.parts) {
        p.score += p.gain;
        if (p.ans && p.ans.ok) p.right++;
        p.hi = !!(p.ans && p.ans.ok);
        p.status = !p.ans ? 'χωρίς απάντηση' : p.ans.ok ? `+${p.gain}` : 'λάθος ✗';
        if (p.ans && p.ans.ok) this.fx(p, `Σωστό! +${p.gain} πόντοι`, [60, 40, 120], true);
        else this.fx(p, p.ans ? `Λάθος! Ήταν: ${this.q.name}` : `Ήταν: ${this.q.name}`, [200]);
      }
      this.sfx(right.length ? 'point' : 'buzz');
      this.changed();
      const id = this.qid;
      this.after(5, () => {
        if (this.qid !== id || !this.running) return;
        if (this.qi >= QN) {
          this.over = true;
          const w = [...this.parts].sort((a, b) => b.score - a.score || b.right - a.right)[0];
          this.finish(w);
        } else this.newRound();
      });
    }

    ctrl(part) {
      const base = { mode: 'choice', q: this.qid, opts: this.opts, colors: OPT_C, letters: LET };
      if (this.phase === 'intro') return { ...base, active: false, label: `Ερώτηση ${this.qi}/${QN}`, sub: 'Κοίτα την τηλεόραση!' };
      if (this.phase === 'reveal') {
        const a = part.ans;
        return { ...base, active: false, picked: a ? a.i : null, correct: this.correct,
          label: !a ? 'Δεν απάντησες' : a.ok ? `Σωστό! +${part.gain}` : 'Λάθος!', sub: `Ήταν: ${this.q.name}` };
      }
      if (part.ans) return { ...base, active: false, picked: part.ans.i, label: 'Κλείδωσε 🔒', sub: 'Περίμενε να δεις αν βρήκες…' };
      return { ...base, active: true, label: 'Ποιος είναι;', sub: `Τώρα παίρνεις ${5 - this.shown} ${5 - this.shown === 1 ? 'πόντο' : 'πόντους'}${this.firstDone ? '' : ' (+1 αν είσαι πρώτος)'}` };
    }

    winText(w) {
      const tie = this.parts.filter((p) => p !== w && p.score === w.score && p.right === w.right).length;
      return `${w.score} πόντοι · ${w.right}/${QN} σωστές` + (tie ? ' (ισοπαλία στην κορυφή!)' : '');
    }

    // ---------- σχεδίαση ----------
    wrap(str, maxW, font) {
      const x = this.ctx; x.font = font;
      const words = str.split(' '), lines = [];
      let cur = '';
      for (const w of words) {
        const t = cur ? cur + ' ' + w : w;
        if (x.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t;
      }
      if (cur) lines.push(cur);
      return lines;
    }

    draw() {
      const x = this.ctx, W = this.W, H = this.H, vh = this.vh;
      const cat = CATS[this.q.cat];
      const g = x.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#2a1260'); g.addColorStop(1, '#0d0628');
      x.fillStyle = g; x.fillRect(0, 0, W, H);
      // ερωτηματικά φόντου
      x.save(); x.globalAlpha = 0.05; x.fillStyle = '#fff'; x.font = this.font(vh * 14, 700, 'Comfortaa');
      x.textAlign = 'center'; x.textBaseline = 'middle';
      for (let i = 0; i < 9; i++) {
        const px = ((i * 0.137 + this.time * 0.012) % 1) * W, py = H * (0.15 + ((i * 0.31) % 0.7));
        x.fillText('?', px, py + Math.sin(this.time + i) * vh * 2);
      }
      x.restore();

      // επικεφαλίδα
      this.text('Ποιος είναι;', W * 0.05, vh * 13, vh * 4.6, '#fff', { fam: 'Comfortaa', w: 700, align: 'left' });
      x.font = this.font(vh * 2.5, 800);
      const cw = x.measureText(cat.name).width + vh * 4;
      U.rr(x, W * 0.95 - cw, vh * 10.3, cw, vh * 5.4, vh * 2.7);
      x.fillStyle = U.rgba(cat.c, 0.2); x.fill(); x.lineWidth = vh * 0.3; x.strokeStyle = cat.c; x.stroke();
      x.fillStyle = cat.c; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText(cat.name, W * 0.95 - cw / 2, vh * 13.05);
      this.text(`Ερώτηση ${this.qi}/${QN}`, W * 0.95 - cw - vh * 2.5, vh * 13.1, vh * 2.8, '#cfc8ea', { align: 'right', stroke: false, w: 600 });

      // κάρτα μυστηρίου
      const cx = W * 0.2, cy = vh * 41, cardW = Math.min(W * 0.27, vh * 40), cardH = vh * 40;
      this.drawCard(cx, cy, cardW, cardH, cat.c);

      // στοιχεία
      const lx = W * 0.37, lw = W * 0.58;
      let y = vh * 20.5;
      for (let i = 0; i < 4; i++) {
        const h = vh * 9.4, on = i < this.shown;
        U.rr(x, lx, y, lw, h, vh * 2);
        x.fillStyle = on ? 'rgba(255,255,255,.1)' : 'rgba(255,255,255,.035)'; x.fill();
        x.lineWidth = vh * 0.3; x.strokeStyle = on && i === this.shown - 1 && this.phase === 'clues' ? cat.c : 'rgba(255,255,255,.12)'; x.stroke();
        // αριθμός και πόντοι
        x.beginPath(); x.arc(lx + vh * 5, y + h / 2, vh * 3, 0, 7);
        x.fillStyle = on ? cat.c : 'rgba(255,255,255,.1)'; x.fill();
        this.text(String(i + 1), lx + vh * 5, y + h / 2, vh * 3, on ? U.INK : 'rgba(255,255,255,.4)', { stroke: false });
        if (on) {
          const k = Math.min(1, (this.time - (i === this.shown - 1 ? this.clueT : -9)) / 0.35);
          x.save(); x.globalAlpha = k; x.translate((1 - k) * vh * 4, 0);
          const f = this.font(vh * 3.1, 700);
          const lines = this.wrap(this.q.clues[i], lw - vh * 25, f).slice(0, 2);
          x.font = f; x.fillStyle = '#fff'; x.textAlign = 'left'; x.textBaseline = 'middle';
          lines.forEach((ln, j) => x.fillText(ln, lx + vh * 10, y + h / 2 + (j - (lines.length - 1) / 2) * vh * 3.8));
          x.restore();
        } else {
          x.font = this.font(vh * 2.6, 600); x.fillStyle = 'rgba(255,255,255,.3)'; x.textAlign = 'left';
          x.fillText('· · ·', lx + vh * 10, y + h / 2);
        }
        x.font = this.font(vh * 2.2, 800); x.textAlign = 'right';
        x.fillStyle = on ? '#ffe8a8' : 'rgba(255,255,255,.28)';
        x.fillText(`${4 - i} ${4 - i === 1 ? 'πόντος' : 'πόντοι'}`, lx + lw - vh * 2.5, y + h / 2);
        y += h + vh * 1.2;
      }
      // μπάρα χρόνου
      if (this.phase === 'clues') {
        const dur = this.shown < 4 ? CLUE_SEC : LAST_SEC;
        const k = U.clamp(1 - (this.time - this.clueT) / dur, 0, 1);
        U.rr(x, lx, y - vh * 0.4, lw, vh * 1.1, vh * 0.55); x.fillStyle = 'rgba(255,255,255,.1)'; x.fill();
        U.rr(x, lx, y - vh * 0.4, lw * k, vh * 1.1, vh * 0.55); x.fillStyle = this.shown < 4 ? cat.c : '#ff6b5e'; x.fill();
        x.font = this.font(vh * 2, 600); x.fillStyle = '#cfc8ea'; x.textAlign = 'right';
        x.fillText(this.shown < 4 ? 'επόμενο στοιχείο' : 'τελευταία ευκαιρία!', lx + lw, y + vh * 2.4);
      }

      // απαντήσεις
      const oy = vh * 68.5, oh = vh * 8.2, og = vh * 1.6, ow = (W * 0.9 - og * 3) / 4;
      for (let i = 0; i < 4; i++) {
        const ox = W * 0.05 + i * (ow + og), c = OPT_C[i];
        const rev = this.phase === 'reveal', good = rev && i === this.correct;
        x.globalAlpha = rev && !good ? 0.35 : 1;
        U.rr(x, ox, oy, ow, oh, vh * 2);
        x.fillStyle = good ? '#2ecc71' : 'rgba(10,5,30,.72)'; x.fill();
        x.lineWidth = vh * (good ? 0.6 : 0.35); x.strokeStyle = good ? '#fff' : c; x.stroke();
        x.beginPath(); x.arc(ox + vh * 4.3, oy + oh / 2, vh * 2.6, 0, 7); x.fillStyle = c; x.fill();
        this.text(LET[i], ox + vh * 4.3, oy + oh / 2, vh * 2.8, U.INK, { stroke: false });
        let fs = vh * 2.5, f = this.font(fs, 800), lines = this.wrap(this.opts[i], ow - vh * 10, f);
        if (lines.length > 2) { fs = vh * 2; f = this.font(fs, 800); lines = this.wrap(this.opts[i], ow - vh * 10, f).slice(0, 3); }
        x.font = f; x.fillStyle = good ? U.INK : '#fff'; x.textAlign = 'left'; x.textBaseline = 'middle';
        lines.forEach((ln, j) => x.fillText(ln, ox + vh * 8, oy + oh / 2 + (j - (lines.length - 1) / 2) * fs * 1.18));
        // ποιοι διάλεξαν αυτή την απάντηση (φαίνεται μόνο στην αποκάλυψη)
        if (rev) {
          const who = this.parts.filter((p) => p.ans && p.ans.i === i);
          who.forEach((p, j) => {
            x.beginPath(); x.arc(ox + ow - vh * 2.6 - j * vh * 3.3, oy, vh * 1.5, 0, 7);
            x.fillStyle = p.color.hex; x.fill(); x.lineWidth = vh * 0.3; x.strokeStyle = U.INK; x.stroke();
          });
        }
        x.globalAlpha = 1;
      }

      this.drawScores();
    }

    drawCard(cx, cy, w, h, col) {
      const x = this.ctx, vh = this.vh, rev = this.phase === 'reveal';
      // γύρισμα της κάρτας στην αποκάλυψη
      const k = rev ? U.clamp((this.time - this.phaseT) / 0.5, 0, 1) : 0;
      const sx = Math.abs(Math.cos(k * Math.PI)) || 0.01, front = k > 0.5;
      x.save(); x.translate(cx, cy); x.scale(sx, 1);
      U.rr(x, -w / 2, -h / 2, w, h, vh * 3);
      x.fillStyle = front ? '#fff7e0' : '#1b0f45'; x.fill();
      x.lineWidth = vh * 0.6; x.strokeStyle = col; x.stroke();
      if (!front) {
        // σιλουέτα με ερωτηματικό
        const bob = Math.sin(this.time * 2) * vh * 0.6;
        x.fillStyle = '#3a2580';
        x.beginPath(); x.arc(0, -h * 0.12 + bob, h * 0.17, 0, 7); x.fill();
        x.beginPath(); x.ellipse(0, h * 0.3 + bob, h * 0.3, h * 0.2, 0, Math.PI, 0); x.fill();
        this.text('?', 0, -h * 0.12 + bob, h * 0.24, '#ffc93d', { fam: 'Comfortaa', w: 700 });
      } else {
        this.text('Ήταν…', 0, -h * 0.3, vh * 3, '#7a6aa8', { stroke: false, w: 700 });
        const f = this.font(vh * 5, 800);
        const lines = this.wrap(this.q.name, w - vh * 5, f);
        const sz = lines.length > 2 ? vh * 4 : vh * 5;
        lines.forEach((ln, j) => this.text(ln, 0, (j - (lines.length - 1) / 2) * sz * 1.2, sz, U.INK, { stroke: false, fam: 'Comfortaa', w: 700 }));
        const n = this.parts.filter((p) => p.ans && p.ans.ok).length;
        this.text(n ? `Το βρήκαν: ${n}` : 'Κανείς δεν το βρήκε!', 0, h * 0.34, vh * 2.6, n ? '#1f9d57' : '#d6453b', { stroke: false, w: 800 });
      }
      x.restore();
    }

    // βαθμολογία με αριθμό πόντων (όχι κουκκίδες)
    drawScores() {
      const x = this.ctx, n = this.parts.length, vh = this.vh;
      const cw = Math.min(this.W * 0.21, vh * 40), ch = vh * 10, gap = vh * 2;
      let X = (this.W - (n * cw + (n - 1) * gap)) / 2;
      const Y = this.H - ch - vh * 2.5;
      for (const p of this.parts) {
        const c = p.color.hex;
        U.rr(x, X, Y, cw, ch, vh * 2);
        x.fillStyle = 'rgba(10,5,30,.8)'; x.fill();
        x.lineWidth = vh * 0.35; x.strokeStyle = p.hi && this.phase === 'reveal' ? '#2ecc71' : p.ans ? c : 'rgba(255,255,255,.16)'; x.stroke();
        const name = p.name + (p.bot ? ' 🤖' : '') + (p.p && !p.p.connected ? ' (εκτός)' : '');
        x.font = this.font(vh * 2.5); x.textAlign = 'left'; x.textBaseline = 'middle'; x.fillStyle = c;
        let nm = name; while (x.measureText(nm).width > cw * 0.62 && nm.length > 2) nm = nm.slice(0, -2) + '…';
        x.fillText(nm, X + vh * 2, Y + vh * 3.2);
        x.font = this.font(vh * 4.2, 700, 'Comfortaa'); x.textAlign = 'right'; x.fillStyle = '#fff';
        x.fillText(String(p.score), X + cw - vh * 2, Y + ch / 2);
        if (p.status) {
          x.font = this.font(vh * 2.1, 700); x.textAlign = 'left';
          x.fillStyle = p.status.startsWith('+') ? '#7dffb0' : p.status.startsWith('λάθος') ? '#ff8a80' : '#e9e4ff';
          x.fillText(p.status, X + vh * 2, Y + vh * 7);
        }
        X += cw + gap;
      }
    }
  }

  Mini.games.who = WhoGame;
})();
