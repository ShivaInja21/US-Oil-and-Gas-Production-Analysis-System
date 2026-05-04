#!/usr/bin/env python3
"""Fetch crude oil production data for all 50 US states from EIA API."""
import os
import sys
import time
from pathlib import Path

# Add parent to path to import eia_client
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'src'))

from eia_client import fetch_series_cached

STATES = {
    'Alabama': 'PET.MCRFPAL2.M',
    'Alaska': 'PET.MCRFPAK2.M',
    'Arizona': 'PET.MCRFPAZ2.M',
    'Arkansas': 'PET.MCRFPAR2.M',
    'California': 'PET.MCRFPCA2.M',
    'Colorado': 'PET.MCRFPCO2.M',
    'Connecticut': 'PET.MCRFPCT2.M',
    'Delaware': 'PET.MCRFPDE2.M',
    'Florida': 'PET.MCRFPFL2.M',
    'Georgia': 'PET.MCRFPGA2.M',
    'Hawaii': 'PET.MCRFPHI2.M',
    'Idaho': 'PET.MCRFPID2.M',
    'Illinois': 'PET.MCRFPIL2.M',
    'Indiana': 'PET.MCRFPIN2.M',
    'Iowa': 'PET.MCRFPIA2.M',
    'Kansas': 'PET.MCRFPKS2.M',
    'Kentucky': 'PET.MCRFPKY2.M',
    'Louisiana': 'PET.MCRFPLA2.M',
    'Maine': 'PET.MCRFPME2.M',
    'Maryland': 'PET.MCRFPMD2.M',
    'Massachusetts': 'PET.MCRFPMA2.M',
    'Michigan': 'PET.MCRFPMI2.M',
    'Minnesota': 'PET.MCRFPMN2.M',
    'Mississippi': 'PET.MCRFPMS2.M',
    'Missouri': 'PET.MCRFPMO2.M',
    'Montana': 'PET.MCRFPMT2.M',
    'Nebraska': 'PET.MCRFPNE2.M',
    'Nevada': 'PET.MCRFPNV2.M',
    'New Hampshire': 'PET.MCRFPNH2.M',
    'New Jersey': 'PET.MCRFPNJ2.M',
    'New Mexico': 'PET.MCRFPNM2.M',
    'New York': 'PET.MCRFPNY2.M',
    'North Carolina': 'PET.MCRFPNC2.M',
    'North Dakota': 'PET.MCRFPND2.M',
    'Ohio': 'PET.MCRFPOH2.M',
    'Oklahoma': 'PET.MCRFPOK2.M',
    'Oregon': 'PET.MCRFPOR2.M',
    'Pennsylvania': 'PET.MCRFPPA2.M',
    'Rhode Island': 'PET.MCRFPRI2.M',
    'South Carolina': 'PET.MCRFPSC2.M',
    'South Dakota': 'PET.MCRFPSD2.M',
    'Tennessee': 'PET.MCRFPTN2.M',
    'Texas': 'PET.MCRFPTX2.M',
    'Utah': 'PET.MCRFPUT2.M',
    'Vermont': 'PET.MCRFPVT2.M',
    'Virginia': 'PET.MCRFPVA2.M',
    'Washington': 'PET.MCRFPWA2.M',
    'West Virginia': 'PET.MCRFPWV2.M',
    'Wisconsin': 'PET.MCRFPWI2.M',
    'Wyoming': 'PET.MCRFPWY2.M',
}

if __name__ == '__main__':
    if not os.getenv('EIA_API_KEY'):
        print('Warning: EIA_API_KEY not set')
    
    success = 0
    failed = 0
    
    for state, series_id in STATES.items():
        try:
            print(f'Fetching {state} ({series_id})...', end=' ')
            df, meta = fetch_series_cached(series_id)
            print(f'✓ {len(df)} records')
            success += 1
            time.sleep(0.5)  # Rate limiting
        except Exception as e:
            print(f'✗ {e}')
            failed += 1
    
    print(f'\nComplete: {success} succeeded, {failed} failed')
