#!/usr/bin/env python3
"""
Script to train/retrain the fake detector model.
Uses BERT embeddings + classifier head to detect fake reports.
"""

import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader
import numpy as np
from transformers import RobertaTokenizer, RobertaModel, RobertaConfig
import os
from sklearn.model_selection import train_test_split

# Training data - Polish reports
# Label: 0 = authentic, 1 = fake
TRAINING_DATA = [
    # === AUTHENTIC REPORTS (label=0) - 55 samples ===
    {"text": "Duża dziura w jezdni na ul. Głównej. Na wysokości numeru 45 znajduje się duża dziura w asfalcie o średnicy około 50cm. Stanowi zagrożenie dla kierowców.", "label": 0},
    {"text": "Uszkodzony chodnik przy ul. Długiej. Dziura w chodniku, niebezpieczeństwo dla pieszych.", "label": 0},
    {"text": "Nie działa latarnia uliczna przy przejściu dla pieszych na skrzyżowaniu ul. Szkolnej i Parkowej.", "label": 0},
    {"text": "Przewrócone drzewo blokuje chodnik przy ul. Lipowej 12 po wczorajszej burzy.", "label": 0},
    {"text": "Zniszczona wiata przystankowa na przystanku Centrum. Rozbita szyba, wszędzie odłamki szkła.", "label": 0},
    {"text": "Nielegalne wysypisko śmieci w lesie przy ul. Leśnej. Odpady budowlane i stare meble.", "label": 0},
    {"text": "Wykolejon tramwaj na Rondzie Mogilskim. Ruch wstrzymany, służby techniczne na miejscu.", "label": 0},
    {"text": "Bardzo śliska nawierzchnia przy mostku na Wiśle. Możliwe oblodzenie, kilka osób już się przewróciło.", "label": 0},
    {"text": "Awaria sygnalizacji świetlnej na skrzyżowaniu ul. Krakowskiej i Wielickiej. Wszystkie światła nie działają.", "label": 0},
    {"text": "Uszkodzony znak drogowy na ul. Długiej. Znak STOP jest wygięty i słabo widoczny.", "label": 0},
    {"text": "Zalana ulica po ulewie na ul. Wodnej. Woda sięga do kolan, samochody nie mogą przejechać.", "label": 0},
    {"text": "Pęknięta rura wodociągowa na ul. Źródlanej. Woda tryska na chodnik.", "label": 0},
    {"text": "Graffiti na ścianie szkoły podstawowej nr 5. Wulgarne napisy wymagają usunięcia.", "label": 0},
    {"text": "Niebezpieczny pies bez właściciela w parku miejskim. Duży, czarny, agresywny.", "label": 0},
    {"text": "Hałas z budowy w nocy przy ul. Cichej 10. Prace prowadzone po 22:00.", "label": 0},
    {"text": "Dziura w drodze na Marszałkowskiej przy numerze 100. Wymiary około 40x30 cm.", "label": 0},
    {"text": "Lampa uliczna na Puławskiej 50 nie działa od 3 dni. Ciemno w nocy.", "label": 0},
    {"text": "Wypadek drogowy na autostradzie A4. Karambol kilku pojazdów, utrudnienia w ruchu.", "label": 0},
    {"text": "Pożar śmietnika na osiedlu Słoneczne. Ogień ugaszony, ale pojemnik zniszczony.", "label": 0},
    {"text": "Osunięcie ziemi na skarpie przy ul. Górskiej. Zagrożenie dla pobliskich budynków.", "label": 0},
    {"text": "Uszkodzona barierka ochronna na moście Grunwaldzkim. Brak kilku elementów.", "label": 0},
    {"text": "Zepsuty automat biletowy na przystanku tramwajowym. Nie przyjmuje monet.", "label": 0},
    {"text": "Wyciek paliwa z samochodu na parkingu przy ul. Handlowej. Plama oleju.", "label": 0},
    {"text": "Uszkodzone ogrodzenie placu zabaw. Dzieci mogą się zranić o sterczące druty.", "label": 0},
    {"text": "Zapadnięty studzienka kanalizacyjna na ul. Mokrej. Niebezpieczeństwo dla pieszych.", "label": 0},
    {"text": "Kolizja dwóch samochodów na skrzyżowaniu ul. Powstańców i Wolności. Kierowcy bezpieczni.", "label": 0},
    {"text": "Zerwana linia elektryczna po burzy na ul. Energetycznej. Iskrzenie, niebezpieczeństwo.", "label": 0},
    {"text": "Niedrożna studzienka ściekowa na ul. Deszczowej. Woda nie spływa po deszczu.", "label": 0},
    {"text": "Uszkodzony przystanek autobusowy. Rozkład jazdy nieczytelny, brak ławki.", "label": 0},
    {"text": "Martwy ptak na chodniku przy ul. Ptasiej. Możliwe zagrożenie sanitarne.", "label": 0},
    {"text": "Nielegalne parkowanie na miejscach dla niepełnosprawnych przy galerii.", "label": 0},
    {"text": "Głośna muzyka z lokalu przy ul. Klubowej po godzinie 23:00.", "label": 0},
    {"text": "Bezdomny potrzebuje pomocy przy dworcu głównym. Leży na ziemi od kilku godzin.", "label": 0},
    {"text": "Uszkodzony chodnik - wystające płyty przy ul. Spacerowej. Starsze osoby potykają się.", "label": 0},
    {"text": "Brak wody w budynku przy ul. Wodociągowej 15 od rana. Problem z przyłączem.", "label": 0},
    {"text": "Pęknięty asfalt na ul. Nowej koło przejazdu kolejowego. Samochody muszą zwalniać.", "label": 0},
    {"text": "Śmieci przy kontenerach na ul. Parkowej. Ktoś wyrzucił stare meble obok pojemników.", "label": 0},
    {"text": "Uszkodzona ławka w parku miejskim. Złamana deska, można się skaleczyć.", "label": 0},
    {"text": "Awaria windy w bloku przy ul. Wysokiej 15. Starsze osoby nie mogą się dostać do mieszkań.", "label": 0},
    {"text": "Zasłonięty znak drogowy przez gałęzie drzewa na ul. Leśnej.", "label": 0},
    {"text": "Rozbita butelka na chodniku przy szkole. Szkło może poranić dzieci.", "label": 0},
    {"text": "Zepsuta fontanna w centrum miasta. Woda nie leci od tygodnia.", "label": 0},
    {"text": "Uszkodzony krawężnik na skrzyżowaniu. Samochody zahaczają podwoziem.", "label": 0},
    {"text": "Brak oświetlenia na parkingu przy markecie. Ciemno i niebezpiecznie wieczorem.", "label": 0},
    {"text": "Dzikie wysypisko śmieci na obrzeżach miasta przy lesie. Worki i gruz budowlany.", "label": 0},
    {"text": "Zatkana kratka ściekowa na ul. Deszczowej. Woda zbiera się po każdym deszczu.", "label": 0},
    {"text": "Niebezpieczne przejście dla pieszych bez oznakowania przy szkole.", "label": 0},
    {"text": "Uszkodzony płot przy boisku szkolnym. Dzieci wychodzą przez dziurę.", "label": 0},
    {"text": "Głęboka kałuża na chodniku przy ul. Mokrej. Piesi muszą chodzić jezdnią.", "label": 0},
    {"text": "Zaniedbany plac zabaw w parku. Huśtawka zepsuta, piaskownica brudna.", "label": 0},
    {"text": "Zepsuta barierka przy schodach do przejścia podziemnego.", "label": 0},
    {"text": "Spalone drzewo po uderzeniu pioruna w parku miejskim.", "label": 0},
    {"text": "Rozlana farba na chodniku przy ul. Malarskiej. Ślisko i brudno.", "label": 0},
    {"text": "Uszkodzona skrzynka elektryczna przy ul. Energetycznej. Otwarta, widać kable.", "label": 0},
    {"text": "Wiatr uszkodził dach garażu przy ul. Garażowej. Blacha zwisa nad chodnikiem.", "label": 0},
    {"text": "Dziura w drodze na Marszałkowskiej przy numerze 100. Wymiary około 40x30 cm, głębokość 10 cm.", "label": 0},
    {"text": "Duża dziura w jezdni na ulicy Nowej. Samochody muszą ją omijać.", "label": 0},
    {"text": "Uszkodzony asfalt na ul. Głównej przy skrzyżowaniu. Krawędzie ostre.", "label": 0},
    {"text": "Wyrwa w jezdni po zimie na ul. Śnieżnej. Głęboka na 15 cm.", "label": 0},
    {"text": "Kolizja dwóch samochodów na skrzyżowaniu. Kierowcy wymienili dane.", "label": 0},
    {"text": "Stłuczka na parkingu przy markecie. Uszkodzone dwa samochody.", "label": 0},
    {"text": "Wypadek na autostradzie. Korek na kilka kilometrów.", "label": 0},
    
    # === FAKE REPORTS (label=1) - 55+ samples ===
    # Fantasy/supernatural (20)
    {"text": "Smok Wawelski atakuje centrum miasta. Wielki czerwony smok ziejący ogniem.", "label": 1},
    {"text": "UFO lądowało na Rynku Głównym. Kosmici wyszli ze statku kosmicznego.", "label": 1},
    {"text": "Latające słonie na drodze. Widziałem jak słonie latały i rzucały kokosami.", "label": 1},
    {"text": "Zombie chodzą po ulicach. Widziałem żywych trupów przy centrum handlowym.", "label": 1},
    {"text": "Wampir zaatakował przechodnia w parku. Ofiara ma ślady ugryzienia na szyi.", "label": 1},
    {"text": "Jednorożec biegał po autostradzie. Biały koń z rogiem na głowie.", "label": 1},
    {"text": "Portal do innego wymiaru otworzył się na placu. Ludzie znikają bez śladu.", "label": 1},
    {"text": "Syrenka śpiewa na Wiśle. Piękna kobieta z rybim ogonem.", "label": 1},
    {"text": "Duch straszy w ratuszu. Biała postać lata po korytarzach.", "label": 1},
    {"text": "Czarodziej rzuca zaklęcia na rynku. Ludzie zamieniają się w żaby.", "label": 1},
    {"text": "Potwór z Loch Ness widziany w Odrze. Wielka głowa wynurzała się z wody.", "label": 1},
    {"text": "Yeti złapany w Tatrach. Wielka owłosiona istota w jaskini.", "label": 1},
    {"text": "Demon opętał autobus miejski. Pasażerowie mówią dziwnymi głosami.", "label": 1},
    {"text": "Troll mieszka pod mostem. Atakuje przechodniów w nocy.", "label": 1},
    {"text": "Krasnoludki kradną jedzenie ze sklepów. Małe brodaty ludziki.", "label": 1},
    {"text": "Godzilla atakuje! Wielki jaszczur niszczy budynki w centrum!", "label": 1},
    {"text": "Superbohater lata nad miastem! Batman zauważony nad ratuszem!", "label": 1},
    {"text": "Niewidzialni ludzie kradną w sklepach! Rzeczy znikają same!", "label": 1},
    {"text": "Mutanty w kanałach! Wielkie szczury wielkości psów atakują!", "label": 1},
    {"text": "Wróżka zamieszkała w fontannie! Spełnia życzenia za złotówkę!", "label": 1},
    {"text": "UFO lądowało na rynku głównym. Kosmici wyszli ze statku.", "label": 1},
    {"text": "Kosmici wyszli ze statku kosmicznego i chodzą po mieście.", "label": 1},
    {"text": "Statek kosmiczny wylądował w parku. Zieloni ludzie wyszli.", "label": 1},
    {"text": "Obcy z kosmosu atakują! Lasery niszczą budynki!", "label": 1},
    {"text": "Latający talerz widziany nad miastem. Światła migają.", "label": 1},
    
    # Spam/advertising (10)
    {"text": "NAJLEPSZE CENY! KLIKNIJ TUTAJ! Sprawdź naszą ofertę na www.spam-link.com!", "label": 1},
    {"text": "Zarób 10000 zł dziennie! Praca z domu, bez wysiłku. Zadzwoń teraz!", "label": 1},
    {"text": "Cudowna dieta! Schudnij 20 kg w tydzień bez ćwiczeń!", "label": 1},
    {"text": "Darmowe iPhone dla pierwszych 100 osób! Kliknij link!", "label": 1},
    {"text": "Kasyno online - wygraj miliony! Bonus powitalny 500%!", "label": 1},
    {"text": "PROMOCJA! TYLKO DZIŚ! Kup jeden, drugi gratis! www.sklep.pl", "label": 1},
    {"text": "Szukasz kredytu? Dzwoń teraz! Bez BIK, bez zaświadczeń!", "label": 1},
    {"text": "Najtańsze pożyczki w internecie! Chwilówki bez sprawdzania!", "label": 1},
    {"text": "HOT SINGLES IN YOUR AREA! Click now! www.dating.com", "label": 1},
    {"text": "Bitcoin milioner! Zainwestuj 500 zł, odbierz 50000! Gwarantowane!", "label": 1},
    
    # Too short/meaningless (15)
    {"text": "Problem. Jest problem.", "label": 1},
    {"text": "Coś się stało.", "label": 1},
    {"text": "Proszę o pomoc.", "label": 1},
    {"text": "Dziwne.", "label": 1},
    {"text": "Test.", "label": 1},
    {"text": "asdfasdf", "label": 1},
    {"text": "123456", "label": 1},
    {"text": "...", "label": 1},
    {"text": "hahahaha lol xd", "label": 1},
    {"text": "xxxxxxxxxxx", "label": 1},
    {"text": "a", "label": 1},
    {"text": "nie wiem", "label": 1},
    {"text": "cokolwiek", "label": 1},
    {"text": "???", "label": 1},
    {"text": "hmm", "label": 1},
    
    # Exaggerations/impossible (5)
    {"text": "Miliardy szczurów atakują miasto. Koniec świata nadchodzi!", "label": 1},
    {"text": "Armagedon na ulicy! Wszyscy umarli! Apokalipsa!", "label": 1},
    {"text": "Całe miasto eksplodowało! Nuklearna katastrofa!", "label": 1},
    {"text": "Inwazja kosmitów! Atakują wszystkie kraje świata jednocześnie!", "label": 1},
    {"text": "Mega-trzęsienie ziemi! Polska się zapada pod wodę!", "label": 1},
    
    # Jokes/tests (5)
    {"text": "To jest żart. Prima aprilis! Nabrałem was!", "label": 1},
    {"text": "Test systemu. Proszę zignorować. Test123.", "label": 1},
    {"text": "Trolluję system. Hehe, zobaczmy czy działa.", "label": 1},
    {"text": "Fake news dla testu. To nie jest prawdziwy raport.", "label": 1},
    {"text": "Uwaga fake! To tylko sprawdzam system.", "label": 1},
]

def load_bert_model(model_dir: str):
    """Load the fine-tuned BERT model and tokenizer"""
    bert_path = os.path.join(model_dir, "bert_model_finetuned.pth")
    
    state_dict = torch.load(bert_path, map_location='cpu')
    vocab_size = state_dict['embeddings.word_embeddings.weight'].shape[0]
    max_position = state_dict['embeddings.position_embeddings.weight'].shape[0]
    
    config = RobertaConfig(
        vocab_size=vocab_size,
        max_position_embeddings=max_position,
        hidden_size=768,
        num_hidden_layers=12,
        num_attention_heads=12,
        intermediate_size=3072
    )
    
    tokenizer = RobertaTokenizer.from_pretrained('roberta-base')
    bert_model = RobertaModel(config)
    bert_model.load_state_dict(state_dict, strict=False)
    bert_model.eval()
    
    return bert_model, tokenizer

def extract_features(text: str, bert_model, tokenizer) -> np.ndarray:
    """Extract BERT embeddings for text"""
    inputs = tokenizer(
        text,
        return_tensors='pt',
        truncation=True,
        padding=True,
        max_length=512
    )
    
    with torch.no_grad():
        outputs = bert_model(**inputs)
        features = outputs.last_hidden_state[:, 0, :].cpu().numpy()
    
    return features[0]

class FakeDetectorDataset(Dataset):
    """Dataset for training fake detector"""
    def __init__(self, features, labels):
        self.features = torch.tensor(features, dtype=torch.float32)
        self.labels = torch.tensor(labels, dtype=torch.long)
    
    def __len__(self):
        return len(self.labels)
    
    def __getitem__(self, idx):
        return self.features[idx], self.labels[idx]

class FakeDetectorHead(nn.Module):
    """Classifier head for fake detection"""
    def __init__(self, input_dim=768, hidden_dims=[256, 64], num_classes=2, dropout=0.3):
        super().__init__()
        
        layers = []
        prev_dim = input_dim
        
        for hidden_dim in hidden_dims:
            layers.extend([
                nn.Linear(prev_dim, hidden_dim),
                nn.ReLU(),
                nn.Dropout(dropout)
            ])
            prev_dim = hidden_dim
        
        layers.append(nn.Linear(prev_dim, num_classes))
        
        self.classifier = nn.Sequential(*layers)
    
    def forward(self, x):
        return self.classifier(x)

def train_model(model_dir: str, epochs: int = 150, batch_size: int = 8, lr: float = 0.0005):
    """Train the fake detector model"""
    print("Loading BERT model...")
    bert_model, tokenizer = load_bert_model(model_dir)
    
    print(f"Extracting features from {len(TRAINING_DATA)} samples...")
    features = []
    labels = []
    
    for item in TRAINING_DATA:
        feat = extract_features(item["text"], bert_model, tokenizer)
        features.append(feat)
        labels.append(item["label"])
    
    features = np.array(features)
    labels = np.array(labels)
    
    print(f"Features shape: {features.shape}")
    print(f"Class distribution: {np.bincount(labels)} (0=authentic, 1=fake)")
    
    # Split data
    X_train, X_val, y_train, y_val = train_test_split(
        features, labels, test_size=0.2, random_state=42, stratify=labels
    )
    
    print(f"Train: {len(X_train)}, Validation: {len(X_val)}")
    
    # Create datasets
    train_dataset = FakeDetectorDataset(X_train, y_train)
    val_dataset = FakeDetectorDataset(X_val, y_val)
    
    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=batch_size)
    
    # Create model
    model = FakeDetectorHead()
    criterion = nn.CrossEntropyLoss()
    optimizer = optim.Adam(model.parameters(), lr=lr, weight_decay=0.01)
    scheduler = optim.lr_scheduler.ReduceLROnPlateau(optimizer, patience=15, factor=0.5)
    
    best_val_acc = 0
    best_model_state = None
    
    print("\nTraining...")
    for epoch in range(epochs):
        # Training
        model.train()
        train_loss = 0
        train_correct = 0
        train_total = 0
        
        for batch_features, batch_labels in train_loader:
            optimizer.zero_grad()
            outputs = model(batch_features)
            loss = criterion(outputs, batch_labels)
            loss.backward()
            optimizer.step()
            
            train_loss += loss.item()
            _, predicted = outputs.max(1)
            train_total += batch_labels.size(0)
            train_correct += predicted.eq(batch_labels).sum().item()
        
        train_acc = 100. * train_correct / train_total
        
        # Validation
        model.eval()
        val_loss = 0
        val_correct = 0
        val_total = 0
        
        with torch.no_grad():
            for batch_features, batch_labels in val_loader:
                outputs = model(batch_features)
                loss = criterion(outputs, batch_labels)
                
                val_loss += loss.item()
                _, predicted = outputs.max(1)
                val_total += batch_labels.size(0)
                val_correct += predicted.eq(batch_labels).sum().item()
        
        val_acc = 100. * val_correct / val_total
        scheduler.step(val_loss)
        
        if val_acc > best_val_acc:
            best_val_acc = val_acc
            best_model_state = model.state_dict().copy()
        
        if (epoch + 1) % 20 == 0:
            print(f"Epoch {epoch+1}/{epochs}: Train Acc: {train_acc:.2f}%, Val Acc: {val_acc:.2f}%")
    
    print(f"\nBest validation accuracy: {best_val_acc:.2f}%")
    
    # Save model
    output_path = os.path.join(model_dir, "fake_detector_head.pth")
    
    # Save with "classifier." prefix to match expected format
    prefixed_state_dict = {f"classifier.{k}": v for k, v in best_model_state.items()}
    torch.save(prefixed_state_dict, output_path)
    print(f"Model saved to {output_path}")
    
    # Test predictions
    print("\nTesting predictions...")
    model.load_state_dict(best_model_state)
    model.eval()
    
    test_texts = [
        ("Uszkodzony chodnik przy ul. Długiej. Dziura w chodniku.", "authentic"),
        ("Smok Wawelski atakuje miasto!", "fake"),
        ("Kolizja dwóch samochodów na skrzyżowaniu. Kierowcy bezpieczni.", "authentic"),
        ("UFO lądowało na rynku. Kosmici wyszli.", "fake"),
        ("Test.", "fake"),
        ("Awaria sygnalizacji świetlnej na skrzyżowaniu.", "authentic"),
        ("Dziura w drodze na Marszałkowskiej. Wymiary 40x30cm.", "authentic"),
        ("Krasnoludki kradną w sklepach!", "fake"),
        ("Zalana ulica po ulewie. Woda sięga do kolan.", "authentic"),
        ("NAJLEPSZE CENY! KLIKNIJ TUTAJ!", "fake"),
    ]
    
    correct = 0
    for text, expected in test_texts:
        feat = extract_features(text, bert_model, tokenizer)
        with torch.no_grad():
            output = model(torch.tensor(feat, dtype=torch.float32).unsqueeze(0))
            probs = torch.softmax(output, dim=1)[0]
            pred = "fake" if probs[1] > 0.5 else "authentic"
            is_correct = pred == expected
            if is_correct:
                correct += 1
            print(f"  '{text[:50]}...' -> {pred} (fake_prob={probs[1]:.4f}) [expected: {expected}] {'✓' if is_correct else '✗'}")
    
    print(f"\nTest accuracy: {correct}/{len(test_texts)} ({100*correct/len(test_texts):.1f}%)")

if __name__ == "__main__":
    model_dir = "detector_model_components"
    train_model(model_dir)
