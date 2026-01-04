#!/usr/bin/env python3
"""
Test script to verify AI Categorization model works correctly
"""
import joblib
import os
import numpy as np

def test_model():
    model_dir = 'model_data'
    pipeline_path = os.path.join(model_dir, 'best_model_pipeline.pkl')
    encoder_path = os.path.join(model_dir, 'label_encoder.pkl')

    print('=' * 60)
    print('AI CATEGORIZATION MODEL TEST')
    print('=' * 60)
    
    # Load model
    print('\n1. Loading model...')
    try:
        model = joblib.load(pipeline_path)
        print(f'   Model type: {type(model)}')
        print(f'   Model: {model}')
    except Exception as e:
        print(f'   ERROR loading model: {e}')
        return
    
    # Load label encoder
    print('\n2. Loading label encoder...')
    try:
        label_encoder = joblib.load(encoder_path)
        print(f'   Categories: {label_encoder.classes_.tolist()}')
    except Exception as e:
        print(f'   ERROR loading encoder: {e}')
        return
    
    # Check predict_proba
    print('\n3. Checking predict_proba...')
    has_proba = hasattr(model, 'predict_proba')
    print(f'   Has predict_proba: {has_proba}')
    
    # Check pipeline steps
    if hasattr(model, 'steps'):
        print('\n4. Pipeline steps:')
        for name, step in model.steps:
            step_has_proba = hasattr(step, 'predict_proba')
            print(f'   - {name}: {type(step).__name__} (predict_proba: {step_has_proba})')
    
    # Test predictions
    print('\n5. Testing predictions...')
    test_texts = [
        'Duża dziura w drodze na ulicy Głównej',
        'Śmieci wyrzucone w lesie',
        'Graffiti na ścianie budynku',
        'Latające słonie rzucają kokosami'  # Fake report test
    ]
    
    for text in test_texts:
        print(f'\n   Text: "{text[:50]}..."')
        try:
            # Predict
            pred_encoded = model.predict([text])[0]
            category = label_encoder.inverse_transform([pred_encoded])[0]
            print(f'   Category: {category}')
            
            # Get probabilities
            if has_proba:
                try:
                    proba = model.predict_proba([text])[0]
                    confidence = float(np.max(proba))
                    print(f'   Confidence: {confidence:.4f} ({confidence*100:.1f}%)')
                    print(f'   All probabilities: {proba}')
                except Exception as e:
                    print(f'   ERROR getting probabilities: {e}')
            else:
                print('   Confidence: N/A (no predict_proba)')
                
        except Exception as e:
            print(f'   ERROR: {e}')
    
    print('\n' + '=' * 60)
    print('TEST COMPLETE')
    print('=' * 60)

if __name__ == '__main__':
    test_model()
